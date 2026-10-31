create table public.business_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default '진행',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint business_projects_title_not_blank check (length(trim(title)) > 0),
  constraint business_projects_status_check check (status in ('계획', '진행', '완료', '보류'))
);

alter table public.business_projects enable row level security;
revoke all on table public.business_projects from public, anon, authenticated;
grant select, insert, update, delete on table public.business_projects to authenticated;
grant all on table public.business_projects to service_role;

create trigger business_projects_set_updated_at
before update on public.business_projects
for each row execute function private.set_updated_at();

create trigger business_projects_audit
after insert or update or delete on public.business_projects
for each row execute function private.write_audit_log();

insert into public.business_projects (id, title, description, status, created_by)
values (
  '21000000-0000-0000-0000-000000000001',
  '사무실 홍보관 개설',
  '사무실과 홍보관 개설에 필요한 용역을 통합 관리하는 프로젝트',
  '진행',
  (select id from public.users where role = 'admin' and deleted_at is null order by created_at limit 1)
);

alter table public.projects
add column business_project_id uuid;

update public.projects
set business_project_id = '21000000-0000-0000-0000-000000000001'
where business_project_id is null;

alter table public.projects
  alter column business_project_id set not null,
  add constraint projects_business_project_id_fkey
    foreign key (business_project_id)
    references public.business_projects(id)
    on delete restrict;

create index projects_business_project_id_idx
on public.projects (business_project_id)
where deleted_at is null;

create index business_projects_status_idx
on public.business_projects (status)
where deleted_at is null;

create or replace function private.can_access_business_project(target_business_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when (select public.current_role()) in ('admin', 'executive', 'staff', 'viewer') then true
    when (select public.current_role()) = 'agent' then exists (
      select 1
      from public.projects service_case
      join public.project_assignees assignee
        on assignee.project_id = service_case.id
       and assignee.deleted_at is null
      where service_case.business_project_id = target_business_project_id
        and service_case.deleted_at is null
        and assignee.user_id = (select auth.uid())
    )
    else false
  end
$$;

revoke all on function private.can_access_business_project(uuid) from public, anon;
grant execute on function private.can_access_business_project(uuid) to authenticated, service_role;

create policy business_projects_select on public.business_projects
for select to authenticated
using (
  private.can_access_business_project(id)
  and (((select public.current_role()) = 'admin') or deleted_at is null)
);

create policy business_projects_insert on public.business_projects
for insert to authenticated
with check ((select public.current_role()) in ('admin', 'staff'));

create policy business_projects_update on public.business_projects
for update to authenticated
using ((select public.current_role()) in ('admin', 'staff'))
with check ((select public.current_role()) in ('admin', 'staff'));

create policy business_projects_delete on public.business_projects
for delete to authenticated
using ((select public.current_role()) = 'admin');

create or replace view public.projects_public
with (security_barrier = true)
as
select
  p.id, p.title, p.category, p.description, p.budget, p.stage,
  p.owner_user_id, p.board_resolution, p.selected_vendor_id, p.selection_reason,
  p.created_at, p.updated_at, p.created_by, p.deleted_at,
  p.business_project_id
from public.projects p
where p.deleted_at is null
  and private.can_access_project(p.id);

revoke all on public.projects_public from public, anon;
grant select on public.projects_public to authenticated, service_role;

comment on table public.business_projects is '여러 용역 건을 묶는 상위 사업·현장 프로젝트';
comment on column public.projects.business_project_id is '용역 건이 속한 상위 프로젝트';
