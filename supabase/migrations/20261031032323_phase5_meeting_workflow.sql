-- Phase 5: atomically create a meeting and its follow-up actions.

create index meetings_search_idx on public.meetings
using gin (to_tsvector('simple', coalesce(agenda, '') || ' ' || coalesce(notes, '') || ' ' || coalesce(decisions, '')))
where deleted_at is null;

create or replace function public.create_meeting_with_actions(
  project_id_value uuid,
  vendor_id_value uuid,
  held_at_value timestamptz,
  method_value text,
  attendees_union_value text,
  attendees_vendor_value text,
  agenda_value text,
  notes_value text,
  decisions_value text,
  action_rows jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.user_role := (select public.current_role());
  meeting_id_value uuid;
  action_row jsonb;
  assignee_id_value uuid;
begin
  if actor_id is null
    or actor_role not in ('admin', 'staff', 'agent')
    or not private.can_write_project(project_id_value) then
    raise exception '협의록을 등록할 권한이 없습니다.' using errcode = '42501';
  end if;
  if method_value not in ('대면', '전화', '화상', '메일') then
    raise exception '협의 방식을 확인해 주세요.' using errcode = '22023';
  end if;
  if nullif(trim(agenda_value), '') is null then
    raise exception '안건을 입력해 주세요.' using errcode = '22023';
  end if;
  if jsonb_typeof(action_rows) <> 'array' then
    raise exception '후속조치 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;
  if vendor_id_value is not null and not exists (
    select 1 from public.project_vendors
    where project_id = project_id_value and vendor_id = vendor_id_value and deleted_at is null
  ) then
    raise exception '해당 용역 건의 참여 업체가 아닙니다.' using errcode = '22023';
  end if;

  insert into public.meetings (
    project_id, vendor_id, held_at, method, attendees_union, attendees_vendor,
    agenda, notes, decisions, created_by
  ) values (
    project_id_value, vendor_id_value, held_at_value, method_value,
    nullif(trim(attendees_union_value), ''), nullif(trim(attendees_vendor_value), ''),
    trim(agenda_value), nullif(trim(notes_value), ''), nullif(trim(decisions_value), ''), actor_id
  ) returning id into meeting_id_value;

  for action_row in select value from jsonb_array_elements(action_rows) loop
    if nullif(trim(action_row->>'content'), '') is null
      or nullif(action_row->>'due_date', '') is null then
      raise exception '후속조치 내용을 확인해 주세요.' using errcode = '22023';
    end if;
    assignee_id_value := nullif(action_row->>'assignee_user_id', '')::uuid;
    if assignee_id_value is not null and not exists (
      select 1 from public.users where id = assignee_id_value and active and deleted_at is null
    ) then
      raise exception '후속조치 담당자를 확인해 주세요.' using errcode = '22023';
    end if;
    insert into public.action_items (
      meeting_id, content, assignee_user_id, due_date, status, created_by
    ) values (
      meeting_id_value, trim(action_row->>'content'), assignee_id_value,
      (action_row->>'due_date')::date, '예정', actor_id
    );
  end loop;
  return meeting_id_value;
end;
$$;

revoke all on function public.create_meeting_with_actions(
  uuid, uuid, timestamptz, text, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.create_meeting_with_actions(
  uuid, uuid, timestamptz, text, text, text, text, text, text, jsonb
) to authenticated, service_role;
