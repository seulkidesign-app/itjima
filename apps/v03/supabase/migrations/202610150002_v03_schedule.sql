begin;
do $$ begin
 if current_setting('v03.project_ref',true) is distinct from 'zzuytanimpiflygrwqfb'
 or to_regclass('public.inbox') is not null or to_regclass('public.schedules') is not null
 or to_regclass('public.v03_progress_requests') is null then
 raise exception 'Verified V03 project and existing schema required'; end if;
end $$;
-- Dates remain in Task. This table records current manual information state,
-- not another date copy and not a replacement for the initial Review/Source.
create table public.v03_schedule_states (
 content_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 type text not null check(type in ('draft_delivery','publish')),
 information_state text not null check(information_state in ('present','not_mentioned','uncertain')),
 revision bigint not null check(revision>0),
 edited_at timestamptz not null default now(),
 primary key(content_id,type),
 foreign key(content_id,user_id) references public.v03_contents(id,user_id) on delete cascade
);
create table public.v03_schedule_requests (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 content_id uuid not null,type text not null,
 expected_revision bigint not null,expected_task_revision bigint,value jsonb not null,result jsonb not null,
 created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['v03_schedule_states','v03_schedule_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy owner_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
 end loop;
end $$;
create function public.v03_update_schedule(
 p_content_id uuid,p_type text,p_information_state text,p_due_date text,
 p_expected_revision bigint,p_expected_task_revision bigint,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare dt date; previous public.v03_schedule_requests; current_revision bigint;
 target public.v03_tasks; task_count integer; requested jsonb; result jsonb;
begin
 if auth.uid() is null then raise exception 'v03_schedule_auth_required'; end if;
 if p_content_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision<0
 or (p_expected_task_revision is not null and p_expected_task_revision<0)
 or p_type is null or p_type not in ('draft_delivery','publish')
 or p_information_state is null or p_information_state not in ('present','not_mentioned','uncertain') then raise exception 'v03_schedule_invalid'; end if;
 if p_information_state='present' then
  if p_due_date is null or p_due_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'v03_schedule_invalid'; end if;
  begin dt:=p_due_date::date;
  exception when invalid_datetime_format or datetime_field_overflow then raise exception 'v03_schedule_invalid'; end;
  if to_char(dt,'YYYY-MM-DD')<>p_due_date then raise exception 'v03_schedule_invalid'; end if;
 elsif p_due_date is not null then raise exception 'v03_schedule_invalid';
 end if;
 requested:=jsonb_build_object('information_state',p_information_state,'due_date',p_due_date);
 perform pg_advisory_xact_lock(hashtextextended('v03_schedule:'||p_request_id::text,0));
 select * into previous from public.v03_schedule_requests where id=p_request_id;
 if found then
  if previous.user_id<>auth.uid() or previous.content_id<>p_content_id or previous.type<>p_type
  or previous.expected_revision<>p_expected_revision
  or previous.expected_task_revision is distinct from p_expected_task_revision
  or previous.value<>requested then raise exception 'v03_schedule_invalid_retry'; end if;
  return previous.result;
 end if;
 -- Locks the parent even when no schedule state/Task exists yet.
 perform 1 from public.v03_contents where id=p_content_id and user_id=auth.uid() for update;
 if not found then raise exception 'v03_schedule_unavailable'; end if;
 select revision into current_revision from public.v03_schedule_states where content_id=p_content_id and type=p_type;
 if coalesce(current_revision,0)<>p_expected_revision then raise exception 'v03_schedule_conflict'; end if;
 select count(*) into task_count from public.v03_tasks where content_id=p_content_id and type=p_type and user_id=auth.uid();
 if task_count>1 then raise exception 'v03_schedule_ambiguous'; end if;
 if task_count=1 then
  select * into target from public.v03_tasks where content_id=p_content_id and type=p_type and user_id=auth.uid() for update;
  if p_expected_task_revision is null or target.revision<>p_expected_task_revision then raise exception 'v03_schedule_conflict'; end if;
  -- Neither completed_at nor Collaboration.status is written here.
  update public.v03_tasks set due_date=dt,revision=revision+1 where id=target.id returning * into target;
 else
  if p_expected_task_revision is not null then raise exception 'v03_schedule_conflict'; end if;
  if p_information_state='present' then
   insert into public.v03_tasks(user_id,content_id,type,title,due_date)
   values(auth.uid(),p_content_id,p_type,case when p_type='draft_delivery' then '가편 전달' else '업로드' end,dt) returning * into target;
  end if;
 end if;
 insert into public.v03_schedule_states(content_id,user_id,type,information_state,revision)
 values(p_content_id,auth.uid(),p_type,p_information_state,p_expected_revision+1)
 on conflict(content_id,type) do update set information_state=excluded.information_state,revision=excluded.revision,edited_at=now();
 result:=jsonb_build_object('content_id',p_content_id,'type',p_type,'revision',p_expected_revision+1,'task_id',target.id,'task_revision',target.revision);
 insert into public.v03_schedule_requests(id,user_id,content_id,type,expected_revision,expected_task_revision,value,result)
 values(p_request_id,auth.uid(),p_content_id,p_type,p_expected_revision,p_expected_task_revision,requested,result);
 return result;
end $$;
revoke all on function public.v03_update_schedule(uuid,text,text,text,bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function public.v03_update_schedule(uuid,text,text,text,bigint,bigint,uuid) to authenticated;
commit;
