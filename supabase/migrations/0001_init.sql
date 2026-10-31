-- DB-Vendor initial schema
-- Amounts are stored in KRW bigint. Dates are KST business dates unless noted.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create type public.user_role as enum ('admin', 'executive', 'staff', 'agent', 'viewer');
create type public.vendor_status as enum ('후보', '견적중', '선정', '계약중', '완료', '탈락', '거래중지');
create type public.project_stage as enum ('견적요청', '비교검토', '선정', '계약', '진행', '준공', '정산완료', '보류');
create type public.project_category as enum ('사업관리', '토지', '홍보관·사무실', '광고·홍보', '기타');
create type public.settlement_status as enum ('미정산', '정산요청', '정산완료');
create type public.event_type as enum ('견적마감', '업체미팅', '이사회상정', '계약체결', '착수', '중간점검', '대금지급', '준공', '보증만료', '후속조치', '기타');
create type public.event_status as enum ('예정', '진행', '완료', '지연');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role public.user_role not null default 'viewer',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  biz_no text,
  ceo text,
  address text,
  category text,
  homepage text,
  bank_name text,
  bank_account text,
  status public.vendor_status not null default '후보',
  memo text,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint vendors_biz_no_format check (biz_no is null or biz_no ~ '^\d{3}-\d{2}-\d{5}$')
);

create table public.vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  name text not null,
  title text,
  phone text,
  email text,
  duty text,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category public.project_category not null,
  description text,
  budget bigint not null default 0,
  stage public.project_stage not null default '견적요청',
  owner_user_id uuid references public.users(id) on delete set null,
  board_resolution text,
  selected_vendor_id uuid references public.vendors(id) on delete set null,
  selection_reason text,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint projects_budget_nonnegative check (budget >= 0)
);

create table public.project_assignees (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz
);

create table public.project_vendors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  role text not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint project_vendors_role_check check (role in ('후보', '선정', '탈락'))
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  version integer not null,
  received_at date not null,
  amount bigint not null,
  vat_included boolean not null default true,
  duration_days integer,
  warranty_months integer,
  payment_terms text,
  items jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint quotes_version_positive check (version > 0),
  constraint quotes_amount_nonnegative check (amount >= 0),
  constraint quotes_duration_nonnegative check (duration_days is null or duration_days >= 0),
  constraint quotes_warranty_nonnegative check (warranty_months is null or warranty_months >= 0),
  constraint quotes_items_array check (jsonb_typeof(items) = 'array')
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  title text not null,
  signed_at date not null,
  start_at date not null,
  end_at date not null,
  amount bigint not null,
  vat bigint not null default 0,
  contract_party text not null,
  parent_contract_id uuid references public.contracts(id) on delete restrict,
  change_reason text,
  original_location text,
  is_sealed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint contracts_amount_nonnegative check (amount >= 0),
  constraint contracts_vat_nonnegative check (vat >= 0),
  constraint contracts_date_order check (start_at <= end_at),
  constraint contracts_party_check check (contract_party in ('조합직접', '업무대행사대행')),
  constraint contracts_parent_not_self check (parent_contract_id is null or parent_contract_id <> id)
);

create table public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  seq integer not null,
  label text not null,
  due_date date not null,
  amount bigint not null,
  paid_at date,
  settlement_status public.settlement_status not null default '미정산',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint payment_schedules_seq_positive check (seq > 0),
  constraint payment_schedules_amount_nonnegative check (amount >= 0)
);

create table public.guarantees (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  type text not null,
  issuer text,
  amount bigint not null default 0,
  starts_at date not null,
  expires_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint guarantees_type_check check (type in ('이행', '하자', '선급금')),
  constraint guarantees_amount_nonnegative check (amount >= 0),
  constraint guarantees_date_order check (starts_at <= expires_at)
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  vendor_id uuid references public.vendors(id) on delete set null,
  held_at timestamptz not null,
  method text not null,
  attendees_union text,
  attendees_vendor text,
  agenda text not null,
  notes text,
  decisions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint meetings_method_check check (method in ('대면', '전화', '화상', '메일'))
);

create table public.contact_logs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  contact_id uuid references public.vendor_contacts(id) on delete set null,
  method text not null,
  at timestamptz not null,
  summary text not null,
  meeting_id uuid references public.meetings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint contact_logs_method_check check (method in ('통화', '문자', '메일', '방문'))
);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete restrict,
  content text not null,
  assignee_user_id uuid references public.users(id) on delete set null,
  due_date date not null,
  status public.event_status not null default '예정',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  type public.event_type not null,
  title text not null,
  date date not null,
  end_date date,
  project_id uuid references public.projects(id) on delete restrict,
  source_type text,
  source_id uuid,
  status public.event_status not null default '예정',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint events_date_order check (end_date is null or date <= end_date),
  constraint events_source_pair check ((source_type is null) = (source_id is null))
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid not null,
  kind text not null,
  file_path text not null,
  file_name text not null,
  version integer not null default 1,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint documents_owner_type_check check (owner_type in ('vendor', 'project', 'quote', 'contract', 'meeting')),
  constraint documents_kind_check check (kind in ('사업자등록증', '견적서', '제안서', '계약서', '보증증권', '회의자료', '기타')),
  constraint documents_version_positive check (version > 0)
);

create table public.vendor_reviews (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  quality smallint not null,
  schedule smallint not null,
  communication smallint not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint vendor_reviews_quality_range check (quality between 1 and 5),
  constraint vendor_reviews_schedule_range check (schedule between 1 and 5),
  constraint vendor_reviews_communication_range check (communication between 1 and 5)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  user_id uuid references auth.users(id) on delete set null,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint audit_logs_action_check check (action in ('INSERT', 'UPDATE', 'DELETE'))
);

-- Active-row uniqueness and lookup indexes.
create unique index users_active_email_uidx on public.users (lower(email)) where deleted_at is null;
create unique index vendors_active_biz_no_uidx on public.vendors (biz_no) where deleted_at is null and biz_no is not null;
create unique index vendor_contacts_one_primary_uidx on public.vendor_contacts (vendor_id) where deleted_at is null and active and is_primary;
create unique index project_assignees_active_uidx on public.project_assignees (project_id, user_id) where deleted_at is null;
create unique index project_vendors_active_uidx on public.project_vendors (project_id, vendor_id) where deleted_at is null;
create unique index project_vendors_selected_uidx on public.project_vendors (project_id) where deleted_at is null and role = '선정';
create unique index quotes_active_version_uidx on public.quotes (project_id, vendor_id, version) where deleted_at is null;
create unique index payment_schedules_active_seq_uidx on public.payment_schedules (contract_id, seq) where deleted_at is null;
create unique index events_active_source_uidx on public.events (source_type, source_id) where deleted_at is null and source_type is not null;
create unique index documents_active_version_uidx on public.documents (owner_type, owner_id, kind, version) where deleted_at is null;

create index users_active_role_idx on public.users (role) where deleted_at is null and active;
create index vendor_contacts_vendor_id_idx on public.vendor_contacts (vendor_id) where deleted_at is null;
create index contact_logs_vendor_id_at_idx on public.contact_logs (vendor_id, at desc) where deleted_at is null;
create index contact_logs_contact_id_idx on public.contact_logs (contact_id) where deleted_at is null;
create index contact_logs_meeting_id_idx on public.contact_logs (meeting_id) where deleted_at is null;
create index projects_owner_user_id_idx on public.projects (owner_user_id) where deleted_at is null;
create index projects_selected_vendor_id_idx on public.projects (selected_vendor_id) where deleted_at is null;
create index projects_stage_category_idx on public.projects (stage, category) where deleted_at is null;
create index project_assignees_user_id_idx on public.project_assignees (user_id, project_id) where deleted_at is null;
create index project_vendors_vendor_id_idx on public.project_vendors (vendor_id, project_id) where deleted_at is null;
create index quotes_project_id_received_at_idx on public.quotes (project_id, received_at desc) where deleted_at is null;
create index quotes_vendor_id_idx on public.quotes (vendor_id) where deleted_at is null;
create index contracts_project_id_idx on public.contracts (project_id) where deleted_at is null;
create index contracts_vendor_id_idx on public.contracts (vendor_id) where deleted_at is null;
create index contracts_parent_contract_id_idx on public.contracts (parent_contract_id) where deleted_at is null and parent_contract_id is not null;
create index payment_schedules_contract_id_due_idx on public.payment_schedules (contract_id, due_date) where deleted_at is null;
create index guarantees_contract_id_expiry_idx on public.guarantees (contract_id, expires_at) where deleted_at is null;
create index meetings_project_id_held_at_idx on public.meetings (project_id, held_at desc) where deleted_at is null;
create index meetings_vendor_id_idx on public.meetings (vendor_id) where deleted_at is null and vendor_id is not null;
create index action_items_meeting_id_idx on public.action_items (meeting_id) where deleted_at is null;
create index action_items_assignee_due_idx on public.action_items (assignee_user_id, due_date) where deleted_at is null;
create index events_project_date_idx on public.events (project_id, date) where deleted_at is null;
create index events_status_date_idx on public.events (status, date) where deleted_at is null;
create index documents_owner_idx on public.documents (owner_type, owner_id) where deleted_at is null;
create index vendor_reviews_vendor_id_idx on public.vendor_reviews (vendor_id) where deleted_at is null;
create index vendor_reviews_project_id_idx on public.vendor_reviews (project_id) where deleted_at is null;
create index audit_logs_record_idx on public.audit_logs (table_name, row_id, at desc) where deleted_at is null;
create index audit_logs_user_id_idx on public.audit_logs (user_id, at desc) where deleted_at is null;
create index users_created_by_idx on public.users (created_by) where deleted_at is null and created_by is not null;
create index vendors_created_by_idx on public.vendors (created_by) where deleted_at is null and created_by is not null;
create index vendor_contacts_created_by_idx on public.vendor_contacts (created_by) where deleted_at is null and created_by is not null;
create index projects_created_by_idx on public.projects (created_by) where deleted_at is null and created_by is not null;
create index project_assignees_created_by_idx on public.project_assignees (created_by) where deleted_at is null and created_by is not null;
create index project_vendors_created_by_idx on public.project_vendors (created_by) where deleted_at is null and created_by is not null;
create index quotes_created_by_idx on public.quotes (created_by) where deleted_at is null and created_by is not null;
create index contracts_created_by_idx on public.contracts (created_by) where deleted_at is null and created_by is not null;
create index payment_schedules_created_by_idx on public.payment_schedules (created_by) where deleted_at is null and created_by is not null;
create index guarantees_created_by_idx on public.guarantees (created_by) where deleted_at is null and created_by is not null;
create index meetings_created_by_idx on public.meetings (created_by) where deleted_at is null and created_by is not null;
create index contact_logs_created_by_idx on public.contact_logs (created_by) where deleted_at is null and created_by is not null;
create index action_items_created_by_idx on public.action_items (created_by) where deleted_at is null and created_by is not null;
create index events_created_by_idx on public.events (created_by) where deleted_at is null and created_by is not null;
create index documents_created_by_idx on public.documents (created_by) where deleted_at is null and created_by is not null;
create index vendor_reviews_created_by_idx on public.vendor_reviews (created_by) where deleted_at is null and created_by is not null;
create index audit_logs_created_by_idx on public.audit_logs (created_by) where deleted_at is null and created_by is not null;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users u
  where u.id = (select auth.uid())
    and u.active
    and u.deleted_at is null
$$;

revoke all on function public.current_role() from public, anon;
grant execute on function public.current_role() to authenticated, service_role;

create or replace function private.can_access_project(target_project_id uuid)
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
      from public.project_assignees pa
      where pa.project_id = target_project_id
        and pa.user_id = (select auth.uid())
        and pa.deleted_at is null
    )
    else false
  end
$$;

create or replace function private.can_write_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when (select public.current_role()) in ('admin', 'staff') then true
    when (select public.current_role()) = 'agent' then exists (
      select 1
      from public.project_assignees pa
      where pa.project_id = target_project_id
        and pa.user_id = (select auth.uid())
        and pa.deleted_at is null
    )
    else false
  end
$$;

create or replace function private.can_access_vendor(target_vendor_id uuid)
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
      from public.project_vendors pv
      join public.project_assignees pa on pa.project_id = pv.project_id and pa.deleted_at is null
      where pv.vendor_id = target_vendor_id
        and pv.deleted_at is null
        and pa.user_id = (select auth.uid())
    )
    else false
  end
$$;

create or replace function private.can_write_vendor(target_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when (select public.current_role()) in ('admin', 'staff') then true
    when (select public.current_role()) = 'agent' then exists (
      select 1
      from public.project_vendors pv
      join public.project_assignees pa on pa.project_id = pv.project_id and pa.deleted_at is null
      where pv.vendor_id = target_vendor_id
        and pv.deleted_at is null
        and pa.user_id = (select auth.uid())
    )
    else false
  end
$$;

create or replace function private.project_for_owner(owner_type text, owner_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case owner_type
    when 'project' then owner_id
    when 'quote' then (select q.project_id from public.quotes q where q.id = owner_id)
    when 'contract' then (select c.project_id from public.contracts c where c.id = owner_id)
    when 'meeting' then (select m.project_id from public.meetings m where m.id = owner_id)
    else null
  end
$$;

create or replace function private.can_access_owner(owner_type text, owner_id uuid, write_access boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner_project_id uuid;
begin
  if owner_type = 'vendor' then
    return case when write_access
      then private.can_write_vendor(owner_id)
      else private.can_access_vendor(owner_id)
    end;
  end if;

  owner_project_id := private.project_for_owner(owner_type, owner_id);
  if owner_project_id is null then
    return false;
  end if;

  return case when write_access
    then private.can_write_project(owner_project_id)
    else private.can_access_project(owner_project_id)
  end;
end;
$$;

revoke all on function private.can_access_project(uuid) from public, anon;
revoke all on function private.can_write_project(uuid) from public, anon;
revoke all on function private.can_access_vendor(uuid) from public, anon;
revoke all on function private.can_write_vendor(uuid) from public, anon;
revoke all on function private.project_for_owner(text, uuid) from public, anon;
revoke all on function private.can_access_owner(text, uuid, boolean) from public, anon;
grant execute on function private.can_access_project(uuid) to authenticated, service_role;
grant execute on function private.can_write_project(uuid) to authenticated, service_role;
grant execute on function private.can_access_vendor(uuid) to authenticated, service_role;
grant execute on function private.can_write_vendor(uuid) to authenticated, service_role;
grant execute on function private.project_for_owner(text, uuid) to authenticated, service_role;
grant execute on function private.can_access_owner(text, uuid, boolean) to authenticated, service_role;

-- Sensitive notes are omitted. Row filtering is explicit because these views run as their owner.
create view public.vendors_public
with (security_barrier = true)
as
select
  v.id, v.name, v.biz_no, v.ceo, v.address, v.category, v.homepage,
  v.bank_name, v.bank_account, v.status, v.memo,
  v.created_at, v.updated_at, v.created_by, v.deleted_at
from public.vendors v
where v.deleted_at is null
  and private.can_access_vendor(v.id);

create view public.projects_public
with (security_barrier = true)
as
select
  p.id, p.title, p.category, p.description, p.budget, p.stage,
  p.owner_user_id, p.board_resolution, p.selected_vendor_id, p.selection_reason,
  p.created_at, p.updated_at, p.created_by, p.deleted_at
from public.projects p
where p.deleted_at is null
  and private.can_access_project(p.id);

revoke all on public.vendors_public, public.projects_public from public, anon;
grant select on public.vendors_public, public.projects_public to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  target_id := case when tg_op = 'DELETE' then old.id else new.id end;
  insert into public.audit_logs (
    table_name, row_id, action, before, after, user_id, created_by
  ) values (
    tg_table_name,
    target_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    (select auth.uid()),
    (select auth.uid())
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.write_audit_log() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'vendors', 'vendor_contacts', 'contact_logs', 'projects',
    'project_assignees', 'project_vendors', 'quotes', 'contracts',
    'payment_schedules', 'guarantees', 'meetings', 'action_items',
    'events', 'documents', 'vendor_reviews'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name, table_name
    );
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function private.write_audit_log()',
      table_name, table_name
    );
  end loop;
end;
$$;

create or replace function private.upsert_source_event(
  event_source_type text,
  event_source_id uuid,
  event_kind public.event_type,
  event_title text,
  event_date date,
  event_end_date date,
  event_project_id uuid,
  event_status_value public.event_status,
  event_memo text,
  event_created_by uuid,
  event_deleted_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if event_deleted_at is not null then
    update public.events
    set
      status = event_status_value,
      deleted_at = event_deleted_at,
      updated_at = now()
    where source_type = event_source_type
      and source_id = event_source_id
      and deleted_at is null;
    return;
  end if;

  insert into public.events (
    type, title, date, end_date, project_id, source_type, source_id,
    status, memo, created_by, deleted_at
  ) values (
    event_kind, event_title, event_date, event_end_date, event_project_id,
    event_source_type, event_source_id, event_status_value, event_memo,
    event_created_by, null
  )
  on conflict (source_type, source_id)
    where deleted_at is null and source_type is not null
  do update set
    type = excluded.type,
    title = excluded.title,
    date = excluded.date,
    end_date = excluded.end_date,
    project_id = excluded.project_id,
    status = excluded.status,
    memo = excluded.memo,
    deleted_at = excluded.deleted_at,
    updated_at = now();
end;
$$;

create or replace function private.sync_payment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.payment_schedules%rowtype;
  project_id_value uuid;
  event_title_value text;
begin
  source_row := case when tg_op = 'DELETE' then old else new end;
  select c.project_id, format('[%s] %s – %s', v.name, c.title, source_row.label)
    into project_id_value, event_title_value
  from public.contracts c
  join public.vendors v on v.id = c.vendor_id
  where c.id = source_row.contract_id;

  perform private.upsert_source_event(
    'payment_schedule', source_row.id, '대금지급', event_title_value,
    source_row.due_date, null, project_id_value,
    case when source_row.paid_at is not null then '완료'::public.event_status else '예정'::public.event_status end,
    null, source_row.created_by,
    case when tg_op = 'DELETE' then now() else source_row.deleted_at end
  );
  return coalesce(new, old);
end;
$$;

create or replace function private.sync_guarantee_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.guarantees%rowtype;
  project_id_value uuid;
  event_title_value text;
begin
  source_row := case when tg_op = 'DELETE' then old else new end;
  select c.project_id, format('[%s] %s보증 만료 30일 전', v.name, source_row.type)
    into project_id_value, event_title_value
  from public.contracts c
  join public.vendors v on v.id = c.vendor_id
  where c.id = source_row.contract_id;

  perform private.upsert_source_event(
    'guarantee', source_row.id, '보증만료', event_title_value,
    source_row.expires_at - 30, null, project_id_value, '예정',
    source_row.issuer, source_row.created_by,
    case when tg_op = 'DELETE' then now() else source_row.deleted_at end
  );
  return coalesce(new, old);
end;
$$;

create or replace function private.sync_action_item_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.action_items%rowtype;
  project_id_value uuid;
begin
  source_row := case when tg_op = 'DELETE' then old else new end;
  select m.project_id into project_id_value
  from public.meetings m where m.id = source_row.meeting_id;

  perform private.upsert_source_event(
    'action_item', source_row.id, '후속조치', source_row.content,
    source_row.due_date, null, project_id_value, source_row.status,
    null, source_row.created_by,
    case when tg_op = 'DELETE' then now() else source_row.deleted_at end
  );
  return coalesce(new, old);
end;
$$;

create or replace function private.sync_contract_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.contracts%rowtype;
  vendor_name text;
  deleted_value timestamptz;
begin
  source_row := case when tg_op = 'DELETE' then old else new end;
  select v.name into vendor_name from public.vendors v where v.id = source_row.vendor_id;
  deleted_value := case when tg_op = 'DELETE' then now() else source_row.deleted_at end;

  perform private.upsert_source_event(
    'contract_start', source_row.id, '착수', format('[%s] %s – 착수', vendor_name, source_row.title),
    source_row.start_at, null, source_row.project_id, '예정', null,
    source_row.created_by, deleted_value
  );
  perform private.upsert_source_event(
    'contract_end', source_row.id, '준공', format('[%s] %s – 준공', vendor_name, source_row.title),
    source_row.end_at, null, source_row.project_id, '예정', null,
    source_row.created_by, deleted_value
  );
  return coalesce(new, old);
end;
$$;

create trigger payment_schedules_sync_event
after insert or update or delete on public.payment_schedules
for each row execute function private.sync_payment_event();
create trigger guarantees_sync_event
after insert or update or delete on public.guarantees
for each row execute function private.sync_guarantee_event();
create trigger action_items_sync_event
after insert or update or delete on public.action_items
for each row execute function private.sync_action_item_event();
create trigger contracts_sync_events
after insert or update or delete on public.contracts
for each row execute function private.sync_contract_events();

revoke all on function private.upsert_source_event(text, uuid, public.event_type, text, date, date, uuid, public.event_status, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.sync_payment_event() from public, anon, authenticated;
revoke all on function private.sync_guarantee_event() from public, anon, authenticated;
revoke all on function private.sync_action_item_event() from public, anon, authenticated;
revoke all on function private.sync_contract_events() from public, anon, authenticated;

create or replace function public.mark_overdue_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.events
  set status = '지연', updated_at = now()
  where deleted_at is null
    and date < (timezone('Asia/Seoul', now()))::date
    and status in ('예정', '진행');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_overdue_events() from public, anon, authenticated;
grant execute on function public.mark_overdue_events() to service_role;

-- RLS is enabled on every public table exposed through the Data API.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'vendors', 'vendor_contacts', 'contact_logs', 'projects',
    'project_assignees', 'project_vendors', 'quotes', 'contracts',
    'payment_schedules', 'guarantees', 'meetings', 'action_items',
    'events', 'documents', 'vendor_reviews', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', table_name);
  end loop;
end;
$$;

-- Profiles.
create policy users_select on public.users for select to authenticated
using (((select public.current_role()) = 'admin') or deleted_at is null);
create policy users_insert on public.users for insert to authenticated
with check ((select public.current_role()) = 'admin');
create policy users_update on public.users for update to authenticated
using ((select public.current_role()) = 'admin')
with check ((select public.current_role()) = 'admin');
create policy users_delete on public.users for delete to authenticated
using ((select public.current_role()) = 'admin');

-- Sensitive base tables: agent/viewer read only through *_public views.
create policy vendors_select_privileged on public.vendors for select to authenticated
using ((select public.current_role()) in ('admin', 'executive', 'staff') and (((select public.current_role()) = 'admin') or deleted_at is null));
create policy vendors_insert on public.vendors for insert to authenticated
with check ((select public.current_role()) in ('admin', 'staff'));
create policy vendors_update on public.vendors for update to authenticated
using ((select public.current_role()) in ('admin', 'staff'))
with check ((select public.current_role()) in ('admin', 'staff'));
create policy vendors_delete on public.vendors for delete to authenticated
using ((select public.current_role()) = 'admin');

create policy projects_select_privileged on public.projects for select to authenticated
using ((select public.current_role()) in ('admin', 'executive', 'staff') and (((select public.current_role()) = 'admin') or deleted_at is null));
create policy projects_insert on public.projects for insert to authenticated
with check ((select public.current_role()) in ('admin', 'staff'));
create policy projects_update on public.projects for update to authenticated
using ((select public.current_role()) in ('admin', 'staff'))
with check ((select public.current_role()) in ('admin', 'staff'));
create policy projects_delete on public.projects for delete to authenticated
using ((select public.current_role()) = 'admin');

-- Vendor-scoped tables.
create policy vendor_contacts_select on public.vendor_contacts for select to authenticated
using ((((select public.current_role()) = 'admin') or deleted_at is null) and private.can_access_vendor(vendor_id));
create policy vendor_contacts_insert on public.vendor_contacts for insert to authenticated
with check (private.can_write_vendor(vendor_id));
create policy vendor_contacts_update on public.vendor_contacts for update to authenticated
using (private.can_write_vendor(vendor_id)) with check (private.can_write_vendor(vendor_id));
create policy vendor_contacts_delete on public.vendor_contacts for delete to authenticated
using ((select public.current_role()) = 'admin');

create policy contact_logs_select on public.contact_logs for select to authenticated
using ((((select public.current_role()) = 'admin') or deleted_at is null) and private.can_access_vendor(vendor_id));
create policy contact_logs_insert on public.contact_logs for insert to authenticated
with check (private.can_write_vendor(vendor_id));
create policy contact_logs_update on public.contact_logs for update to authenticated
using (private.can_write_vendor(vendor_id)) with check (private.can_write_vendor(vendor_id));
create policy contact_logs_delete on public.contact_logs for delete to authenticated
using ((select public.current_role()) = 'admin');

-- Project membership tables.
create policy project_assignees_select on public.project_assignees for select to authenticated
using ((((select public.current_role()) = 'admin') or deleted_at is null) and ((select public.current_role()) in ('admin', 'executive', 'staff', 'viewer') or user_id = (select auth.uid())));
create policy project_assignees_insert on public.project_assignees for insert to authenticated
with check ((select public.current_role()) in ('admin', 'staff'));
create policy project_assignees_update on public.project_assignees for update to authenticated
using ((select public.current_role()) in ('admin', 'staff')) with check ((select public.current_role()) in ('admin', 'staff'));
create policy project_assignees_delete on public.project_assignees for delete to authenticated
using ((select public.current_role()) = 'admin');

create policy project_vendors_select on public.project_vendors for select to authenticated
using ((((select public.current_role()) = 'admin') or deleted_at is null) and private.can_access_project(project_id));
create policy project_vendors_insert on public.project_vendors for insert to authenticated
with check (private.can_write_project(project_id));
create policy project_vendors_update on public.project_vendors for update to authenticated
using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
create policy project_vendors_delete on public.project_vendors for delete to authenticated
using ((select public.current_role()) = 'admin');

-- Direct project children.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['quotes', 'contracts', 'meetings', 'events', 'vendor_reviews'] loop
    execute format(
      'create policy %I_select on public.%I for select to authenticated using ((((select public.current_role()) = ''admin'') or deleted_at is null) and private.can_access_project(project_id))',
      table_name, table_name
    );
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (private.can_write_project(project_id))',
      table_name, table_name
    );
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (private.can_write_project(project_id)) with check (private.can_write_project(project_id))',
      table_name, table_name
    );
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using ((select public.current_role()) = ''admin'')',
      table_name, table_name
    );
  end loop;
end;
$$;

-- Contract children.
create policy payment_schedules_select on public.payment_schedules for select to authenticated
using ((((select public.current_role()) = 'admin') or deleted_at is null) and exists (select 1 from public.contracts c where c.id = contract_id and private.can_access_project(c.project_id)));
create policy payment_schedules_insert on public.payment_schedules for insert to authenticated
with check (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_project(c.project_id)));
create policy payment_schedules_update on public.payment_schedules for update to authenticated
using (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_project(c.project_id)))
with check (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_project(c.project_id)));
create policy payment_schedules_delete on public.payment_schedules for delete to authenticated
using ((select public.current_role()) = 'admin');

create policy guarantees_select on public.guarantees for select to authenticated
using ((((select public.current_role()) = 'admin') or deleted_at is null) and exists (select 1 from public.contracts c where c.id = contract_id and private.can_access_project(c.project_id)));
create policy guarantees_insert on public.guarantees for insert to authenticated
with check (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_project(c.project_id)));
create policy guarantees_update on public.guarantees for update to authenticated
using (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_project(c.project_id)))
with check (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_project(c.project_id)));
create policy guarantees_delete on public.guarantees for delete to authenticated
using ((select public.current_role()) = 'admin');

-- Meeting children.
create policy action_items_select on public.action_items for select to authenticated
using ((((select public.current_role()) = 'admin') or deleted_at is null) and exists (select 1 from public.meetings m where m.id = meeting_id and private.can_access_project(m.project_id)));
create policy action_items_insert on public.action_items for insert to authenticated
with check (exists (select 1 from public.meetings m where m.id = meeting_id and private.can_write_project(m.project_id)));
create policy action_items_update on public.action_items for update to authenticated
using (exists (select 1 from public.meetings m where m.id = meeting_id and private.can_write_project(m.project_id)))
with check (exists (select 1 from public.meetings m where m.id = meeting_id and private.can_write_project(m.project_id)));
create policy action_items_delete on public.action_items for delete to authenticated
using ((select public.current_role()) = 'admin');

-- Polymorphic documents.
create policy documents_select on public.documents for select to authenticated
using ((((select public.current_role()) = 'admin') or deleted_at is null) and private.can_access_owner(owner_type, owner_id, false));
create policy documents_insert on public.documents for insert to authenticated
with check (private.can_access_owner(owner_type, owner_id, true));
create policy documents_update on public.documents for update to authenticated
using (private.can_access_owner(owner_type, owner_id, true))
with check (private.can_access_owner(owner_type, owner_id, true));
create policy documents_delete on public.documents for delete to authenticated
using ((select public.current_role()) = 'admin');

create policy audit_logs_select on public.audit_logs for select to authenticated
using (
  (((select public.current_role()) = 'admin') or deleted_at is null)
  and ((select public.current_role()) in ('admin', 'executive', 'staff', 'viewer') or user_id = (select auth.uid()))
);
create policy audit_logs_delete on public.audit_logs for delete to authenticated
using ((select public.current_role()) = 'admin');

-- Private Storage bucket. Object operations must go through the Storage API.
insert into storage.buckets (id, name, public, file_size_limit)
values ('vendor-files', 'vendor-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function private.storage_owner_type(object_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select (storage.foldername(object_name))[1]
$$;

create or replace function private.storage_owner_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  value text := (storage.foldername(object_name))[2];
begin
  if value is null or value !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return value::uuid;
end;
$$;

revoke all on function private.storage_owner_type(text) from public, anon;
revoke all on function private.storage_owner_id(text) from public, anon;
grant execute on function private.storage_owner_type(text), private.storage_owner_id(text) to authenticated, service_role;

create policy vendor_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'vendor-files'
  and private.storage_owner_type(name) in ('vendor', 'project', 'quote', 'contract', 'meeting')
  and private.can_access_owner(private.storage_owner_type(name), private.storage_owner_id(name), false)
);
create policy vendor_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendor-files'
  and private.storage_owner_type(name) in ('vendor', 'project', 'quote', 'contract', 'meeting')
  and private.can_access_owner(private.storage_owner_type(name), private.storage_owner_id(name), true)
);
create policy vendor_files_update on storage.objects for update to authenticated
using (
  bucket_id = 'vendor-files'
  and private.can_access_owner(private.storage_owner_type(name), private.storage_owner_id(name), true)
)
with check (
  bucket_id = 'vendor-files'
  and private.can_access_owner(private.storage_owner_type(name), private.storage_owner_id(name), true)
);
create policy vendor_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'vendor-files'
  and private.can_access_owner(private.storage_owner_type(name), private.storage_owner_id(name), true)
);

comment on column public.contracts.amount is '공급가액(원). 계약총액은 amount + vat.';
comment on column public.contracts.vat is '부가가치세(원).';
comment on column public.contracts.parent_contract_id is '변경계약의 직전 계약. amount와 vat는 변경 후 최종 금액이며 증감액은 부모 계약과 비교해 계산한다.';
comment on view public.vendors_public is 'agent/viewer용 internal_note 제외 보안 뷰';
comment on view public.projects_public is 'agent/viewer용 internal_note 제외 보안 뷰';
