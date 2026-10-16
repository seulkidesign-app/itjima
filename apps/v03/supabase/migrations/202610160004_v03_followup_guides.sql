begin;
do $$ begin
 if current_setting('v03.project_ref',true) is distinct from 'zzuytanimpiflygrwqfb' or to_regclass('public.inbox') is not null or to_regclass('public.schedules') is not null or to_regclass('public.v03_schedule_states') is null then raise exception 'Verified current V03 schema required';end if;
end $$;
-- No historical timestamp is invented. Existing sources retain null metadata.
alter table public.v03_sources add column import_id uuid unique;
alter table public.v03_sources add constraint v03_source_import_owner foreign key(import_id,user_id) references public.v03_imports(id,user_id);
alter table public.v03_sources add column registered_at timestamptz;
alter table public.v03_sources alter column registered_at set default clock_timestamp();
alter table public.v03_sources add column guide_order bigint;
alter table public.v03_sources add constraint v03_source_order unique(collaboration_id,guide_order);
alter table public.v03_sources add constraint v03_source_followup_metadata check(import_id is null or (registered_at is not null and guide_order>0));
create function public.v03_validate_guide(p jsonb) returns void language plpgsql set search_path='' as $$
declare r jsonb;ids text[]:='{}';
begin
 if p is null or jsonb_typeof(p)<>'object' or p-array['mode','confirmed','collaboration_id','source']<>'{}'::jsonb or p->>'mode' is distinct from 'followup_guide' or p->'confirmed' is distinct from 'true'::jsonb or coalesce(p->>'collaboration_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid_guide';end if;
 if jsonb_typeof(p->'source') is distinct from 'object' or (p->'source')-array['raw_text','images']<>'{}'::jsonb or jsonb_typeof(p#>'{source,raw_text}') is distinct from 'string' or length(p#>>'{source,raw_text}')>20000 or jsonb_typeof(p#>'{source,images}') is distinct from 'array' or jsonb_array_length(p#>'{source,images}')>4 then raise exception 'invalid_guide_source';end if;
 if regexp_replace(p#>>'{source,raw_text}','[[:space:]' || chr(160) || chr(12288) || ']','','g')='' and jsonb_array_length(p#>'{source,images}')=0 then raise exception 'guide_source_required';end if;
 for r in select value from jsonb_array_elements(p#>'{source,images}') loop
  if jsonb_typeof(r)<>'object' or r-array['id','name','size','type']<>'{}'::jsonb or coalesce(r->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or r->>'id'=any(ids) or jsonb_typeof(r->'name') is distinct from 'string' or length(r->>'name') not between 1 and 255 or jsonb_typeof(r->'size') is distinct from 'number' or coalesce(r->>'size','') !~ '^\d+$' or (r->>'size')::numeric not between 1 and 10485760 or coalesce(r->>'type','') not in ('image/jpeg','image/png','image/webp') then raise exception 'invalid_guide_image';end if;
  ids:=array_append(ids,r->>'id');
 end loop;
end $$;
create function public.v03_prepare_guide_import(p_id uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.v03_imports;sid uuid;
begin
 if auth.uid() is null or p_id is null then raise exception 'authentication_required';end if;
 perform public.v03_validate_guide(p_payload);
 if not exists(select 1 from public.v03_collaborations where id=(p_payload->>'collaboration_id')::uuid and user_id=auth.uid()) then raise exception 'guide_unavailable';end if;
 insert into public.v03_imports(id,user_id,payload) values(p_id,auth.uid(),p_payload) on conflict(id) do nothing;
 select * into row from public.v03_imports where id=p_id and user_id=auth.uid() for update;
 if row.id is null or row.payload<>p_payload or row.state='aborted' then raise exception 'invalid_import_retry';end if;
 select id into sid from public.v03_sources where import_id=p_id and user_id=auth.uid();
 return jsonb_build_object('state',row.state,'source_id',sid);
end $$;
create function public.v03_commit_guide_import(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare row public.v03_imports;cid uuid;sid uuid;r jsonb;imgs jsonb:='[]';path text;seq bigint;
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 select * into row from public.v03_imports where id=p_id and user_id=auth.uid() for update;
 if row.id is null then raise exception 'import_not_found';end if;
 perform public.v03_validate_guide(row.payload);
 cid:=(row.payload->>'collaboration_id')::uuid;
 perform 1 from public.v03_collaborations where id=cid and user_id=auth.uid() for update;
 if not found then raise exception 'guide_unavailable';end if;
 if row.state='committed' then
  select id into sid from public.v03_sources where import_id=p_id and user_id=auth.uid();
  if sid is null then raise exception 'guide_receipt_missing';end if;
  return sid;
 end if;
 if row.state<>'pending' then raise exception 'import_aborted';end if;
 for r in select value from jsonb_array_elements(row.payload#>'{source,images}') loop
  path:=auth.uid()::text||'/'||p_id::text||'/'||(r->>'id');
  if not exists(select 1 from storage.objects o where o.bucket_id='v03-sources' and o.name=path and (o.metadata->>'size')::bigint=(r->>'size')::bigint) then raise exception 'source_image_missing';end if;
  imgs:=imgs||jsonb_build_array(jsonb_build_object('path',path,'name',r->>'name','size',r->'size','type',r->>'type'));
 end loop;
 select coalesce(max(guide_order),0)+1 into seq from public.v03_sources where collaboration_id=cid;
 insert into public.v03_sources(user_id,collaboration_id,raw_text,images,import_id,guide_order) values(auth.uid(),cid,row.payload#>>'{source,raw_text}',imgs,p_id,seq) returning id into sid;
 update public.v03_imports set state='committed',collaboration_id=cid where id=p_id;
 return sid;
end $$;
revoke all on function public.v03_validate_guide(jsonb),public.v03_prepare_guide_import(uuid,jsonb),public.v03_commit_guide_import(uuid) from public,anon,authenticated;
grant execute on function public.v03_prepare_guide_import(uuid,jsonb),public.v03_commit_guide_import(uuid) to authenticated;
commit;
