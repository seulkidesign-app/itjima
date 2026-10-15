begin;
do $$ begin
 if current_setting('v03.project_ref',true) is distinct from 'zzuytanimpiflygrwqfb' or to_regclass('public.inbox') is not null or to_regclass('public.schedules') is not null or to_regclass('public.v03_schedule_states') is null then raise exception 'Verified current V03 schema required';end if;
end $$;
alter table public.v03_constraints drop constraint v03_constraints_review_state_check;
alter table public.v03_constraints add constraint v03_constraints_review_state_check check(review_state in ('confirmed','edited','manual'));
create function public.v03_validate_manual(p jsonb) returns void language plpgsql set search_path='' as $$
declare r jsonb;k text;d text;dt date;ids text[];
begin
 if p is null or jsonb_typeof(p)<>'object' or p-array['mode','origin','confirmed','collaboration','content','schedules','tasks','constraints','source']<>'{}'::jsonb or p->>'mode' is distinct from 'manual' or p->>'origin' is distinct from 'manual' or p->'confirmed' is distinct from 'true'::jsonb then raise exception 'invalid_manual';end if;
 if jsonb_typeof(p->'collaboration') is distinct from 'object' or (p->'collaboration')-array['title','notes']<>'{}'::jsonb or jsonb_typeof(p#>'{collaboration,title}') is distinct from 'string' or length(trim(p#>>'{collaboration,title}')) not between 1 and 120 or p#>'{collaboration,notes}' is null or jsonb_typeof(p#>'{collaboration,notes}') not in ('string','null') or length(p#>>'{collaboration,notes}')>5000 then raise exception 'invalid_manual_collaboration';end if;
 if jsonb_typeof(p->'content') is distinct from 'object' or (p->'content')-array['platform']<>'{}'::jsonb or p#>'{content,platform}' is null or jsonb_typeof(p#>'{content,platform}') not in ('string','null') or length(p#>>'{content,platform}')>120 then raise exception 'invalid_manual_platform';end if;
 if jsonb_typeof(p->'schedules') is distinct from 'object' or (p->'schedules')-array['draft_delivery','publish']<>'{}'::jsonb then raise exception 'invalid_manual_dates';end if;
 foreach k in array array['draft_delivery','publish'] loop
  if p->'schedules'->k is null or jsonb_typeof(p->'schedules'->k) not in ('string','null') then raise exception 'invalid_manual_date';end if;
  d:=p->'schedules'->>k;
  if d is not null then
   if d !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_manual_date';end if;
   begin dt:=d::date;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'invalid_manual_date';end;
   if to_char(dt,'YYYY-MM-DD')<>d then raise exception 'invalid_manual_date';end if;
  end if;
 end loop;
 foreach k in array array['tasks','constraints'] loop
  if jsonb_typeof(p->k) is distinct from 'array' or jsonb_array_length(p->k)>30 then raise exception 'invalid_manual_items';end if;
  ids:='{}';
  for r in select value from jsonb_array_elements(p->k) loop
   if jsonb_typeof(r)<>'object' or r-array['id','value']<>'{}'::jsonb or coalesce(r->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or r->>'id'=any(ids) or jsonb_typeof(r->'value') is distinct from 'string' or length(trim(r->>'value')) not between 1 and 2000 then raise exception 'invalid_manual_item';end if;
   ids:=array_append(ids,r->>'id');
  end loop;
 end loop;
 if jsonb_typeof(p->'source') is distinct from 'object' or (p->'source')-array['raw_text','images']<>'{}'::jsonb or jsonb_typeof(p#>'{source,raw_text}') is distinct from 'string' or length(p#>>'{source,raw_text}')>20000 or jsonb_typeof(p#>'{source,images}') is distinct from 'array' or jsonb_array_length(p#>'{source,images}')>4 then raise exception 'invalid_manual_source';end if;
 ids:='{}';
 for r in select value from jsonb_array_elements(p#>'{source,images}') loop
  if jsonb_typeof(r)<>'object' or r-array['id','name','size','type']<>'{}'::jsonb or coalesce(r->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or r->>'id'=any(ids) or jsonb_typeof(r->'name') is distinct from 'string' or length(r->>'name') not between 1 and 255 or jsonb_typeof(r->'size') is distinct from 'number' or coalesce(r->>'size','') !~ '^\d+$' or (r->>'size')::numeric not between 1 and 10485760 or coalesce(r->>'type','') not in ('image/jpeg','image/png','image/webp') then raise exception 'invalid_manual_image';end if;
  ids:=array_append(ids,r->>'id');
 end loop;
end $$;
revoke all on function public.v03_validate_manual(jsonb) from public,anon,authenticated;
create function public.v03_prepare_manual_import(p_id uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.v03_imports;
begin
 if auth.uid() is null or p_id is null then raise exception 'authentication_required';end if;
 perform public.v03_validate_manual(p_payload);
 insert into public.v03_imports(id,user_id,payload) values(p_id,auth.uid(),p_payload) on conflict(id) do nothing;
 select * into row from public.v03_imports where id=p_id and user_id=auth.uid() for update;
 if row.id is null or row.payload<>p_payload or row.state='aborted' then raise exception 'invalid_import_retry';end if;
 return jsonb_build_object('state',row.state,'collaboration_id',row.collaboration_id);
end $$;
create function public.v03_commit_manual_import(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare row public.v03_imports;cid uuid;ctid uuid;sid uuid;r jsonb;imgs jsonb:='[]';path text;k text;d text;
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 select * into row from public.v03_imports where id=p_id and user_id=auth.uid() for update;
 if row.id is null then raise exception 'import_not_found';end if;
 perform public.v03_validate_manual(row.payload);
 if row.state='committed' then return row.collaboration_id;end if;
 if row.state<>'pending' then raise exception 'import_aborted';end if;
 for r in select value from jsonb_array_elements(row.payload#>'{source,images}') loop
  path:=auth.uid()::text||'/'||p_id::text||'/'||(r->>'id');
  if not exists(select 1 from storage.objects o where o.bucket_id='v03-sources' and o.name=path and (o.metadata->>'size')::bigint=(r->>'size')::bigint) then raise exception 'source_image_missing';end if;
  imgs:=imgs||jsonb_build_array(jsonb_build_object('path',path,'name',r->>'name','size',r->'size','type',r->>'type'));
 end loop;
 insert into public.v03_collaborations(user_id,title,status,notes,import_id) values(auth.uid(),trim(row.payload#>>'{collaboration,title}'),'discussion',row.payload#>>'{collaboration,notes}',p_id) returning id into cid;
 insert into public.v03_contents(user_id,collaboration_id,title,platform) values(auth.uid(),cid,trim(row.payload#>>'{collaboration,title}'),row.payload#>>'{content,platform}') returning id into ctid;
 insert into public.v03_sources(user_id,collaboration_id,raw_text,images) values(auth.uid(),cid,row.payload#>>'{source,raw_text}',imgs) returning id into sid;
 insert into public.v03_reviews(user_id,source_id,candidate) values(auth.uid(),sid,jsonb_build_object('candidate_id','manual_registration','origin','manual','entry',row.payload-array['source'],'evidence',null));
 foreach k in array array['draft_delivery','publish'] loop
  d:=row.payload->'schedules'->>k;
  insert into public.v03_reviews(user_id,source_id,candidate) values(auth.uid(),sid,jsonb_build_object('candidate_id',case k when 'draft_delivery' then 'draft_due' else 'publish_due' end,'origin','manual','due_date',d)||case when d is null then jsonb_build_object('input_state','not_entered') else jsonb_build_object('information_state','present') end);
  if d is not null then insert into public.v03_tasks(user_id,content_id,type,title,due_date) values(auth.uid(),ctid,k,case k when 'draft_delivery' then '가편 전달' else '업로드 예정' end,d::date);end if;
 end loop;
 for r in select value from jsonb_array_elements(row.payload->'tasks') loop
  insert into public.v03_tasks(user_id,content_id,type,title) values(auth.uid(),ctid,'custom',trim(r->>'value'));
 end loop;
 for r in select value from jsonb_array_elements(row.payload->'constraints') loop
  insert into public.v03_constraints(user_id,collaboration_id,type,value,information_state,review_state) values(auth.uid(),cid,'manual',trim(r->>'value'),'present','manual');
 end loop;
 update public.v03_imports set state='committed',collaboration_id=cid where id=p_id;
 return cid;
end $$;
revoke all on function public.v03_prepare_manual_import(uuid,jsonb),public.v03_commit_manual_import(uuid) from public,anon,authenticated;
grant execute on function public.v03_prepare_manual_import(uuid,jsonb),public.v03_commit_manual_import(uuid) to authenticated;
-- Preserve the strict historical mock validator; remove remote sample write permission.
revoke execute on function public.v03_prepare_import(uuid,jsonb),public.v03_commit_import(uuid) from authenticated,anon,public;
commit;
