-- Phase 3: executive selection approval with column-level guards and one atomic RPC.

create or replace function private.guard_executive_project_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select public.current_role()) = 'executive'
    and (to_jsonb(new) - array['stage', 'selected_vendor_id', 'selection_reason', 'board_resolution'])
      is distinct from
      (to_jsonb(old) - array['stage', 'selected_vendor_id', 'selection_reason', 'board_resolution']) then
    raise exception '조합 임원은 선정 승인 정보만 변경할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.guard_executive_vendor_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select public.current_role()) = 'executive'
    and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception '조합 임원은 업체 선정 상태만 변경할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.guard_executive_project_vendor_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select public.current_role()) = 'executive'
    and (to_jsonb(new) - array['role', 'reason'])
      is distinct from
      (to_jsonb(old) - array['role', 'reason']) then
    raise exception '조합 임원은 참여 업체의 선정 결과만 변경할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_executive_project_update() from public, anon, authenticated;
revoke all on function private.guard_executive_vendor_update() from public, anon, authenticated;
revoke all on function private.guard_executive_project_vendor_update() from public, anon, authenticated;

create trigger guard_executive_project_update
before update on public.projects
for each row execute function private.guard_executive_project_update();

create trigger guard_executive_vendor_update
before update on public.vendors
for each row execute function private.guard_executive_vendor_update();

create trigger guard_executive_project_vendor_update
before update on public.project_vendors
for each row execute function private.guard_executive_project_vendor_update();

drop policy projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
using ((select public.current_role()) in ('admin', 'staff', 'executive'))
with check ((select public.current_role()) in ('admin', 'staff', 'executive'));

drop policy vendors_update on public.vendors;
create policy vendors_update on public.vendors for update to authenticated
using ((select public.current_role()) in ('admin', 'staff', 'executive'))
with check ((select public.current_role()) in ('admin', 'staff', 'executive'));

drop policy project_vendors_update on public.project_vendors;
create policy project_vendors_update on public.project_vendors for update to authenticated
using (
  (select public.current_role()) = 'executive'
  or private.can_write_project(project_id)
)
with check (
  (select public.current_role()) = 'executive'
  or private.can_write_project(project_id)
);

create or replace function public.select_project_vendor(
  target_project_id uuid,
  target_vendor_id uuid,
  selection_reason_value text,
  board_resolution_value text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or (select public.current_role()) not in ('admin', 'executive') then
    raise exception '업체 선정 승인 권한이 없습니다.' using errcode = '42501';
  end if;

  if nullif(trim(selection_reason_value), '') is null
    or nullif(trim(board_resolution_value), '') is null then
    raise exception '선정 사유와 이사회 회차·일자를 입력해 주세요.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.project_vendors pv
    where pv.project_id = target_project_id
      and pv.vendor_id = target_vendor_id
      and pv.deleted_at is null
  ) then
    raise exception '해당 용역 건의 참여 업체가 아닙니다.' using errcode = '22023';
  end if;

  update public.project_vendors
  set role = case when vendor_id = target_vendor_id then '선정' else '탈락' end,
      reason = case
        when vendor_id = target_vendor_id then trim(selection_reason_value)
        else coalesce(reason, '미선정')
      end
  where project_id = target_project_id
    and deleted_at is null;

  update public.vendors
  set status = '선정'
  where id = target_vendor_id
    and deleted_at is null;

  update public.projects
  set selected_vendor_id = target_vendor_id,
      selection_reason = trim(selection_reason_value),
      board_resolution = trim(board_resolution_value),
      stage = '선정'
  where id = target_project_id
    and deleted_at is null;

  if not found then
    raise exception '용역 건을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.select_project_vendor(uuid, uuid, text, text) from public, anon;
grant execute on function public.select_project_vendor(uuid, uuid, text, text) to authenticated, service_role;
