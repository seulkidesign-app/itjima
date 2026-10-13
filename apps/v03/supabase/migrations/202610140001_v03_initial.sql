begin;
do $$ begin
 if coalesce(current_setting('v03.project_ref',true),'') !~ '^[a-z]{20}$'
 or current_setting('v03.project_ref',true)='bopiuworvbjsowfjbmfx'
 or to_regclass('public.inbox') is not null or to_regclass('public.schedules') is not null
 then raise exception 'Verified V03 project required; V02 database is forbidden'; end if;
end $$;

create table public.v03_imports (
 id uuid primary key,user_id uuid not null references auth.users(id),payload jsonb not null,
 state text not null default 'pending' check(state in ('pending','committed','aborted')),
 collaboration_id uuid,created_at timestamptz not null default now(),unique(id,user_id)
);
create table public.v03_collaborations (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 120),
 status text not null check(status in ('discussion','producing','draft_sent','in_review','scheduled','completed','on_hold')),
 contact_date date,notes text,import_id uuid not null unique,created_at timestamptz not null default now(),unique(id,user_id),
 foreign key(import_id,user_id) references public.v03_imports(id,user_id)
);
alter table public.v03_imports add foreign key(collaboration_id,user_id) references public.v03_collaborations(id,user_id);
create table public.v03_contents (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),collaboration_id uuid not null,
 title text not null,platform text,content_url text,ad_code text,performance jsonb,
 foreign key(collaboration_id,user_id) references public.v03_collaborations(id,user_id),unique(id,user_id)
);
create table public.v03_tasks (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),content_id uuid not null,
 type text not null,title text not null,due_date date,completed_at timestamptz,
 foreign key(content_id,user_id) references public.v03_contents(id,user_id)
);
create table public.v03_sources (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),collaboration_id uuid not null,
 raw_text text not null,images jsonb not null default '[]',unique(id,user_id),
 foreign key(collaboration_id,user_id) references public.v03_collaborations(id,user_id)
);
create table public.v03_constraints (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),collaboration_id uuid not null,
 type text not null,value text,information_state text not null check(information_state in ('present','not_mentioned','uncertain')),
 review_state text not null check(review_state in ('confirmed','edited')),
 foreign key(collaboration_id,user_id) references public.v03_collaborations(id,user_id),
 check((information_state='present' and value is not null and length(trim(value))>0) or (information_state<>'present' and value is null))
);
create table public.v03_reviews (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),source_id uuid not null,candidate jsonb not null,
 foreign key(source_id,user_id) references public.v03_sources(id,user_id)
);

do $$ declare t text; begin
 foreach t in array array['v03_imports','v03_collaborations','v03_contents','v03_tasks','v03_sources','v03_constraints','v03_reviews'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

-- Independent server gate: no direct table writes, no reliance on client readiness.
create function public.v03_validate_payload(p jsonb) returns void language plpgsql set search_path='' as $$
declare r jsonb; ids text[]:='{}'; image_ids text[]:='{}'; key text; expected_group text; dt date;
begin
 if p is null or jsonb_typeof(p->'review') is distinct from 'array' or jsonb_array_length(p->'review')=0 then raise exception 'review_required'; end if;
 if length(trim(coalesce(p#>>'{collaboration,title}',''))) not between 1 and 120 then raise exception 'title_required'; end if;
 if coalesce(p#>>'{collaboration,status}','') not in ('discussion','producing','draft_sent','in_review','scheduled','completed','on_hold') then raise exception 'invalid_status'; end if;
 if jsonb_typeof(p#>'{source,images}') is distinct from 'array' or jsonb_array_length(p#>'{source,images}')>4 then raise exception 'invalid_images'; end if;
 if length(coalesce(p#>>'{source,raw_text}',''))>20000 then raise exception 'source_too_long'; end if;
 if length(trim(coalesce(p#>>'{source,raw_text}','')))=0 and jsonb_array_length(p#>'{source,images}')=0 then raise exception 'source_required'; end if;
 for r in select value from jsonb_array_elements(p->'review') loop
 if coalesce(r->>'candidate_id','')='' or r->>'candidate_id'=any(ids) then raise exception 'duplicate_candidate'; end if;
 ids:=array_append(ids,r->>'candidate_id');
 if coalesce(r->>'group','') not in ('schedules','tasks','constraints') or coalesce(r->>'review_state','') not in ('confirmed','edited') or coalesce(r->>'information_state','') not in ('present','not_mentioned','uncertain') then raise exception 'unreviewed_candidate'; end if;
 expected_group:=case when r->>'candidate_id' in ('draft_due','publish_due') then 'schedules' when r->>'candidate_id' in ('film','captions','approval') then 'tasks' when r->>'candidate_id' in ('thumbnail','platform','retention','usage_rights') then 'constraints' else r->>'group' end;
 if r->>'group'<>expected_group then raise exception 'incorrect_candidate_group'; end if;
 if r->>'information_state'='present' then
 if length(trim(coalesce(r->>'value',''))) not between 1 and 2000 then raise exception 'value_required'; end if;
 if r->>'group'='schedules' then
 if coalesce(r->>'due_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'date_required'; end if;
 dt:=(r->>'due_date')::date;
 if to_char(dt,'YYYY-MM-DD')<>r->>'due_date' then raise exception 'invalid_date'; end if;
 elsif r->>'due_date' is not null then raise exception 'non_schedule_date'; end if;
 elsif r->>'value' is not null or r->>'due_date' is not null then raise exception 'unresolved_value_must_be_null'; end if;
 end loop;
 foreach key in array array['draft_due','publish_due','film','captions','approval','thumbnail','platform','retention','usage_rights'] loop
 if not key=any(ids) then raise exception 'required_candidate_missing'; end if;
 end loop;
 for r in select value from jsonb_array_elements(p#>'{source,images}') loop
 if coalesce(r->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or r->>'id'=any(image_ids)
 or coalesce((r->>'size')::bigint,0) not between 1 and 10485760 or coalesce(r->>'type','') not in ('image/jpeg','image/png','image/webp') then raise exception 'invalid_image'; end if;
 image_ids:=array_append(image_ids,r->>'id');
 end loop;
end $$;
revoke all on function public.v03_validate_payload(jsonb) from public;

create function public.v03_prepare_import(p_id uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.v03_imports;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 perform public.v03_validate_payload(p_payload);
 insert into public.v03_imports(id,user_id,payload) values(p_id,auth.uid(),p_payload) on conflict(id) do nothing;
 select * into row from public.v03_imports where id=p_id and user_id=auth.uid() for update;
 if row.id is null or row.payload<>p_payload or row.state='aborted' then raise exception 'invalid_import_retry'; end if;
 return jsonb_build_object('state',row.state,'collaboration_id',row.collaboration_id);
end $$;

create function public.v03_commit_import(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare row public.v03_imports;cid uuid;ctid uuid;sid uuid;r jsonb;imgs jsonb:='[]';path text;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 select * into row from public.v03_imports where id=p_id and user_id=auth.uid() for update;
 if row.id is null then raise exception 'import_not_found'; end if;
 if row.state='committed' then return row.collaboration_id; end if;
 if row.state<>'pending' then raise exception 'import_aborted'; end if;
 perform public.v03_validate_payload(row.payload);
 for r in select value from jsonb_array_elements(row.payload#>'{source,images}') loop
 path:=auth.uid()::text||'/'||p_id::text||'/'||(r->>'id');
 if not exists(select 1 from storage.objects o where o.bucket_id='v03-sources' and o.name=path and (o.metadata->>'size')::bigint=(r->>'size')::bigint) then raise exception 'source_image_missing'; end if;
 imgs:=imgs||jsonb_build_array(jsonb_build_object('path',path,'name',r->>'name','size',r->'size','type',r->>'type'));
 end loop;
 insert into public.v03_collaborations(user_id,title,status,import_id) values(auth.uid(),row.payload#>>'{collaboration,title}',row.payload#>>'{collaboration,status}',p_id) returning id into cid;
 insert into public.v03_contents(user_id,collaboration_id,title,platform) values(auth.uid(),cid,row.payload#>>'{collaboration,title}',(select v->>'value' from jsonb_array_elements(row.payload->'review') v where v->>'candidate_id'='platform')) returning id into ctid;
 insert into public.v03_sources(user_id,collaboration_id,raw_text,images) values(auth.uid(),cid,coalesce(row.payload#>>'{source,raw_text}',''),imgs) returning id into sid;
 for r in select value from jsonb_array_elements(row.payload->'review') loop
 insert into public.v03_reviews(user_id,source_id,candidate) values(auth.uid(),sid,r);
 if r->>'group' in ('schedules','tasks') and r->>'information_state'='present' then
 insert into public.v03_tasks(user_id,content_id,type,title,due_date) values(auth.uid(),ctid,
 case r->>'candidate_id' when 'draft_due' then 'draft_delivery' when 'publish_due' then 'publish' else 'custom' end,
 case when r->>'group'='schedules' then coalesce(r->>'label',r->>'value') else r->>'value' end,
 case when r->>'group'='schedules' then (r->>'due_date')::date else null end);
 elsif r->>'group'='constraints' then
 insert into public.v03_constraints(user_id,collaboration_id,type,value,information_state,review_state) values(auth.uid(),cid,r->>'candidate_id',r->>'value',r->>'information_state',r->>'review_state');
 end if;
 end loop;
 update public.v03_imports set state='committed',collaboration_id=cid where id=p_id;
 return cid;
end $$;
create function public.v03_abort_import(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.v03_imports set state='aborted' where id=p_id and user_id=auth.uid() and state='pending';
 return found;
end $$;
revoke all on function public.v03_prepare_import(uuid,jsonb),public.v03_commit_import(uuid),public.v03_abort_import(uuid) from public;
grant execute on function public.v03_prepare_import(uuid,jsonb),public.v03_commit_import(uuid),public.v03_abort_import(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('v03-sources','v03-sources',false,10485760,array['image/jpeg','image/png','image/webp']);
create function public.v03_object_allowed(path text,mode text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.v03_imports i cross join lateral jsonb_array_elements(i.payload#>'{source,images}') img
 where i.user_id=auth.uid() and path=i.user_id::text||'/'||i.id::text||'/'||(img->>'id')
 and ((mode='read' and i.state in ('pending','committed','aborted')) or (mode='write' and i.state='pending') or (mode='cleanup' and i.state='aborted')));
$$;
revoke all on function public.v03_object_allowed(text,text) from public;
grant execute on function public.v03_object_allowed(text,text) to authenticated;
create policy v03_source_read on storage.objects for select to authenticated using(bucket_id='v03-sources' and public.v03_object_allowed(name,'read'));
create policy v03_source_insert on storage.objects for insert to authenticated with check(bucket_id='v03-sources' and public.v03_object_allowed(name,'write'));
create policy v03_source_update on storage.objects for update to authenticated using(bucket_id='v03-sources' and public.v03_object_allowed(name,'write')) with check(bucket_id='v03-sources' and public.v03_object_allowed(name,'write'));
create policy v03_source_delete on storage.objects for delete to authenticated using(bucket_id='v03-sources' and public.v03_object_allowed(name,'cleanup'));
commit;
