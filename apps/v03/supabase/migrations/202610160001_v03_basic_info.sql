begin;
do $$ begin
 if current_setting('v03.project_ref',true) is distinct from 'zzuytanimpiflygrwqfb' or to_regclass('public.inbox') is not null or to_regclass('public.schedules') is not null or to_regprocedure('public.v03_commit_manual_import(uuid)') is null then raise exception 'Verified current V03 required';end if;
end $$;
alter table public.v03_contents add column revision bigint not null default 0 check(revision>=0);
create table public.v03_basic_requests (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 collaboration_id uuid not null,content_id uuid,expected_revision bigint not null,expected_content_revision bigint,
 value jsonb not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table public.v03_basic_requests enable row level security;
revoke all on public.v03_basic_requests from public,anon,authenticated;
grant select on public.v03_basic_requests to authenticated;
create policy owner_read on public.v03_basic_requests for select to authenticated using(user_id=auth.uid());
create function public.v03_update_basic_info(
 p_id uuid,p_content_id uuid,p_title text,p_notes text,p_platform text,
 p_expected_revision bigint,p_expected_content_revision bigint,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.v03_basic_requests;target public.v03_collaborations;content public.v03_contents;requested jsonb;result jsonb;
begin
 if auth.uid() is null then raise exception 'v03_basic_auth_required';end if;
 if p_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision<0
 or p_title is null or length(trim(p_title))=0 or length(p_title)>120
 or length(p_notes)>5000 or length(p_platform)>120
 or (p_content_id is null and (p_expected_content_revision is not null or p_platform is not null))
 or (p_content_id is not null and (p_expected_content_revision is null or p_expected_content_revision<0)) then raise exception 'v03_basic_invalid';end if;
 requested:=jsonb_build_object('title',trim(p_title),'notes',nullif(trim(p_notes),''),'platform',nullif(trim(p_platform),''));
 perform pg_advisory_xact_lock(hashtextextended('v03_basic:'||p_request_id::text,0));
 select * into previous from public.v03_basic_requests where id=p_request_id;
 if found then
  if previous.user_id<>auth.uid() or previous.collaboration_id<>p_id or previous.content_id is distinct from p_content_id
  or previous.expected_revision<>p_expected_revision or previous.expected_content_revision is distinct from p_expected_content_revision
  or previous.value<>requested then raise exception 'v03_basic_invalid_retry';end if;
  return previous.result;
 end if;
 -- Shared Collaboration revision also detects intervening status changes.
 select * into target from public.v03_collaborations where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'v03_basic_unavailable';end if;
 if target.revision<>p_expected_revision then raise exception 'v03_basic_conflict';end if;
 if p_content_id is not null then
  select * into content from public.v03_contents where id=p_content_id and collaboration_id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'v03_basic_unavailable';end if;
  if content.revision<>p_expected_content_revision then raise exception 'v03_basic_conflict';end if;
  update public.v03_contents set platform=requested->>'platform',revision=revision+1 where id=content.id returning * into content;
 end if;
 -- No source, import, review, status, Task or schedule writes.
 update public.v03_collaborations set title=requested->>'title',notes=requested->>'notes',revision=revision+1 where id=target.id returning * into target;
 result:=jsonb_build_object('id',target.id,'revision',target.revision,'content_id',p_content_id,'content_revision',content.revision);
 insert into public.v03_basic_requests(id,user_id,collaboration_id,content_id,expected_revision,expected_content_revision,value,result)
 values(p_request_id,auth.uid(),p_id,p_content_id,p_expected_revision,p_expected_content_revision,requested,result);
 return result;
end $$;
revoke all on function public.v03_update_basic_info(uuid,uuid,text,text,text,bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function public.v03_update_basic_info(uuid,uuid,text,text,text,bigint,bigint,uuid) to authenticated;
commit;
