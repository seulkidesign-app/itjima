begin;
do $$ begin
 if current_setting('v03.project_ref',true) is distinct from 'zzuytanimpiflygrwqfb'
 or to_regclass('public.inbox') is not null or to_regclass('public.schedules') is not null
 or to_regclass('public.v03_collaborations') is null then
 raise exception 'Verified V03 project and existing schema required'; end if;
end $$;

alter table public.v03_collaborations add column revision bigint not null default 0 check(revision>=0);
alter table public.v03_tasks add column revision bigint not null default 0 check(revision>=0);
create table public.v03_progress_requests (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 target_kind text not null check(target_kind in ('status','task')),
 target_id uuid not null,
 expected_revision bigint not null check(expected_revision>=0),
 value jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.v03_progress_requests enable row level security;
revoke all on public.v03_progress_requests from public,anon,authenticated;
grant select on public.v03_progress_requests to authenticated;
create policy owner_read on public.v03_progress_requests for select to authenticated using(user_id=auth.uid());

-- Serialize equal request IDs before locking the target. The receipt is committed
-- in the same transaction as the row update; identical retries return that receipt.
create function public.v03_progress_retry(p_request_id uuid,p_kind text,p_id uuid,p_revision bigint,p_value jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare previous public.v03_progress_requests;
begin
 if auth.uid() is null then raise exception 'v03_progress_auth_required'; end if;
 if p_request_id is null or p_id is null or p_revision is null or p_revision<0 then raise exception 'v03_progress_invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into previous from public.v03_progress_requests where id=p_request_id;
 if found then
  if previous.user_id<>auth.uid() or previous.target_kind<>p_kind or previous.target_id<>p_id
  or previous.expected_revision<>p_revision or previous.value is distinct from p_value then raise exception 'v03_progress_invalid_retry'; end if;
  return previous.result;
 end if;
 return null;
end $$;
revoke all on function public.v03_progress_retry(uuid,text,uuid,bigint,jsonb) from public,anon,authenticated;

create function public.v03_update_collaboration_status(p_id uuid,p_status text,p_expected_revision bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.v03_collaborations; result jsonb;
begin
 if p_status is null or p_status not in ('discussion','producing','draft_sent','in_review','scheduled','completed','on_hold') then raise exception 'v03_progress_invalid'; end if;
 result:=public.v03_progress_retry(p_request_id,'status',p_id,p_expected_revision,to_jsonb(p_status));
 if result is not null then return result; end if;
 select * into target from public.v03_collaborations where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'v03_progress_unavailable'; end if;
 if target.revision<>p_expected_revision then raise exception 'v03_progress_conflict'; end if;
 update public.v03_collaborations set status=p_status,revision=revision+1 where id=target.id returning * into target;
 result:=jsonb_build_object('id',target.id,'status',target.status,'revision',target.revision);
 insert into public.v03_progress_requests(id,user_id,target_kind,target_id,expected_revision,value,result)
 values(p_request_id,auth.uid(),'status',p_id,p_expected_revision,to_jsonb(p_status),result);
 return result;
end $$;

create function public.v03_set_task_completed(p_id uuid,p_completed boolean,p_expected_revision bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.v03_tasks; result jsonb;
begin
 if p_completed is null then raise exception 'v03_progress_invalid'; end if;
 result:=public.v03_progress_retry(p_request_id,'task',p_id,p_expected_revision,to_jsonb(p_completed));
 if result is not null then return result; end if;
 select * into target from public.v03_tasks where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'v03_progress_unavailable'; end if;
 if target.revision<>p_expected_revision then raise exception 'v03_progress_conflict'; end if;
 update public.v03_tasks set completed_at=case when p_completed then now() else null end,revision=revision+1
 where id=target.id returning * into target;
 result:=jsonb_build_object('id',target.id,'completed_at',target.completed_at,'revision',target.revision);
 insert into public.v03_progress_requests(id,user_id,target_kind,target_id,expected_revision,value,result)
 values(p_request_id,auth.uid(),'task',p_id,p_expected_revision,to_jsonb(p_completed),result);
 return result;
end $$;
revoke all on function public.v03_update_collaboration_status(uuid,text,bigint,uuid),public.v03_set_task_completed(uuid,boolean,bigint,uuid) from public,anon,authenticated;
grant execute on function public.v03_update_collaboration_status(uuid,text,bigint,uuid),public.v03_set_task_completed(uuid,boolean,bigint,uuid) to authenticated;
commit;
