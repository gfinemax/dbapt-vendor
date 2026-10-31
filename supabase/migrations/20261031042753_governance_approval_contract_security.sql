-- Governance: auditable approvals, final-value contract amendments,
-- separated sensitive data, and an ERP integration outbox.

create type public.approval_status as enum (
  'draft', 'requested', 'approved', 'rejected', 'cancelled'
);
create type public.approval_target_type as enum (
  'vendor_selection', 'contract', 'contract_amendment'
);
create type public.erp_sync_status as enum ('pending', 'sent', 'failed');

alter table public.contracts
  add column approval_status public.approval_status not null default 'requested',
  add column approved_by uuid references public.users(id) on delete set null,
  add column approved_at timestamptz;

-- Existing rows were already treated as effective contracts before approval
-- workflow existed, so preserve that operational meaning during migration.
update public.contracts
set approval_status = 'approved',
    approved_by = created_by,
    approved_at = created_at;

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
  deleted_value := case
    when tg_op = 'DELETE' or source_row.approval_status <> 'approved' then now()
    else source_row.deleted_at
  end;
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
  contract_approved boolean := false;
begin
  source_row := case when tg_op = 'DELETE' then old else new end;
  select c.project_id,
         c.approval_status = 'approved',
         format('[%s] %s – %s', v.name, c.title, source_row.label)
    into project_id_value, contract_approved, event_title_value
  from public.contracts c
  join public.vendors v on v.id = c.vendor_id
  where c.id = source_row.contract_id;
  perform private.upsert_source_event(
    'payment_schedule', source_row.id, '대금지급', event_title_value,
    source_row.due_date, null, project_id_value,
    case when source_row.paid_at is not null then '완료'::public.event_status else '예정'::public.event_status end,
    null, source_row.created_by,
    case
      when tg_op = 'DELETE' or not contract_approved then now()
      else source_row.deleted_at
    end
  );
  return coalesce(new, old);
end;
$$;

create table public.contract_amendments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  sequence integer not null,
  title text not null,
  signed_at date not null,
  start_at date not null,
  end_at date not null,
  previous_amount bigint not null,
  previous_vat bigint not null,
  final_amount bigint not null,
  final_vat bigint not null,
  change_reason text not null,
  original_location text,
  is_sealed boolean not null default false,
  approval_status public.approval_status not null default 'requested',
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  legacy_contract_id uuid unique references public.contracts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint contract_amendments_sequence_positive check (sequence > 0),
  constraint contract_amendments_amount_nonnegative check (final_amount >= 0 and final_vat >= 0),
  constraint contract_amendments_previous_nonnegative check (previous_amount >= 0 and previous_vat >= 0),
  constraint contract_amendments_date_order check (start_at <= end_at),
  constraint contract_amendments_reason_present check (length(trim(change_reason)) > 0)
);

create unique index contract_amendments_active_sequence_uidx
  on public.contract_amendments (contract_id, sequence)
  where deleted_at is null;
create index contract_amendments_contract_idx
  on public.contract_amendments (contract_id, signed_at desc)
  where deleted_at is null;

-- Convert legacy delta rows to immutable final-value amendment history while
-- retaining the source contract rows for provenance.
with ordered as (
  select
    child.*,
    row_number() over (
      partition by child.parent_contract_id
      order by child.signed_at, child.created_at, child.id
    )::integer as amendment_sequence,
    coalesce(sum(child.amount) over (
      partition by child.parent_contract_id
      order by child.signed_at, child.created_at, child.id
      rows between unbounded preceding and 1 preceding
    ), 0)::bigint as prior_amount_delta,
    coalesce(sum(child.vat) over (
      partition by child.parent_contract_id
      order by child.signed_at, child.created_at, child.id
      rows between unbounded preceding and 1 preceding
    ), 0)::bigint as prior_vat_delta
  from public.contracts child
  where child.parent_contract_id is not null
    and child.deleted_at is null
)
insert into public.contract_amendments (
  contract_id, sequence, title, signed_at, start_at, end_at,
  previous_amount, previous_vat, final_amount, final_vat,
  change_reason, original_location, is_sealed, approval_status,
  approved_by, approved_at, legacy_contract_id, created_at, updated_at,
  created_by, deleted_at
)
select
  root.id,
  ordered.amendment_sequence,
  ordered.title,
  ordered.signed_at,
  ordered.start_at,
  ordered.end_at,
  root.amount + ordered.prior_amount_delta,
  root.vat + ordered.prior_vat_delta,
  root.amount + ordered.prior_amount_delta + ordered.amount,
  root.vat + ordered.prior_vat_delta + ordered.vat,
  coalesce(nullif(trim(ordered.change_reason), ''), '기존 변경계약 이관'),
  ordered.original_location,
  ordered.is_sealed,
  'approved',
  ordered.approved_by,
  ordered.approved_at,
  ordered.id,
  ordered.created_at,
  ordered.updated_at,
  ordered.created_by,
  ordered.deleted_at
from ordered
join public.contracts root on root.id = ordered.parent_contract_id;

-- The master contract always carries the latest approved final value.
with latest as (
  select distinct on (contract_id)
    contract_id, final_amount, final_vat, start_at, end_at
  from public.contract_amendments
  where deleted_at is null and approval_status = 'approved'
  order by contract_id, sequence desc
)
update public.contracts contract
set amount = latest.final_amount,
    vat = latest.final_vat,
    start_at = latest.start_at,
    end_at = latest.end_at
from latest
where contract.id = latest.contract_id;

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  target_type public.approval_target_type not null,
  target_id uuid not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  title text not null,
  status public.approval_status not null default 'requested',
  snapshot jsonb not null default '{}'::jsonb,
  requested_by uuid not null references public.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint approval_requests_requested_status check (status <> 'draft'),
  constraint approval_requests_decision_shape check (
    (status in ('requested', 'cancelled') and decided_by is null and decided_at is null)
    or (status in ('approved', 'rejected') and decided_by is not null and decided_at is not null)
  ),
  constraint approval_requests_rejection_reason check (
    status <> 'rejected' or length(trim(coalesce(decision_reason, ''))) > 0
  )
);

create unique index approval_requests_open_target_uidx
  on public.approval_requests (target_type, target_id)
  where deleted_at is null and status = 'requested';
create index approval_requests_status_requested_idx
  on public.approval_requests (status, requested_at desc)
  where deleted_at is null;
create index approval_requests_project_idx
  on public.approval_requests (project_id, requested_at desc)
  where deleted_at is null;

create table public.project_internal_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint project_internal_notes_content_present check (length(trim(content)) > 0)
);

create table public.vendor_internal_notes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint vendor_internal_notes_content_present check (length(trim(content)) > 0)
);

create table public.vendor_financial_details (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  bank_name text,
  bank_account text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz
);

create unique index vendor_financial_details_active_vendor_uidx
  on public.vendor_financial_details (vendor_id)
  where deleted_at is null;
create unique index vendor_internal_notes_active_vendor_uidx
  on public.vendor_internal_notes (vendor_id)
  where deleted_at is null;
create index project_internal_notes_project_idx
  on public.project_internal_notes (project_id, created_at desc)
  where deleted_at is null;
create index vendor_internal_notes_vendor_idx
  on public.vendor_internal_notes (vendor_id, created_at desc)
  where deleted_at is null;

insert into public.project_internal_notes (project_id, content, created_by, created_at, updated_at)
select id, internal_note, created_by, created_at, updated_at
from public.projects
where nullif(trim(internal_note), '') is not null;

insert into public.vendor_internal_notes (vendor_id, content, created_by, created_at, updated_at)
select id, internal_note, created_by, created_at, updated_at
from public.vendors
where nullif(trim(internal_note), '') is not null;

insert into public.vendor_financial_details (
  vendor_id, bank_name, bank_account, created_by, created_at, updated_at
)
select id, bank_name, bank_account, created_by, created_at, updated_at
from public.vendors
where bank_name is not null or bank_account is not null;

drop view if exists public.vendors_public;
alter table public.projects drop column internal_note;
alter table public.vendors
  drop column internal_note,
  drop column bank_name,
  drop column bank_account;

create table public.erp_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  status public.erp_sync_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint erp_sync_outbox_attempts_nonnegative check (attempts >= 0),
  constraint erp_sync_outbox_aggregate_type check (aggregate_type in ('contract', 'contract_amendment')),
  constraint erp_sync_outbox_event_type check (event_type = 'approved')
);

create unique index erp_sync_outbox_event_uidx
  on public.erp_sync_outbox (aggregate_type, aggregate_id, event_type)
  where deleted_at is null;
create index erp_sync_outbox_pending_idx
  on public.erp_sync_outbox (status, created_at)
  where deleted_at is null;

-- Add grants explicitly because Data API exposure and RLS are separate controls.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'contract_amendments', 'approval_requests',
    'project_internal_notes', 'vendor_internal_notes',
    'vendor_financial_details', 'erp_sync_outbox'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', table_name);
  end loop;
end;
$$;

-- Base tables are now free of internal notes and financial details, so row RLS
-- can safely protect both direct Data API access and security-invoker views.
drop policy if exists vendors_select_privileged on public.vendors;
create policy vendors_select on public.vendors for select to authenticated
using (
  (((select public.current_role()) = 'admin') or deleted_at is null)
  and private.can_access_vendor(id)
);

drop policy if exists projects_select_privileged on public.projects;
create policy projects_select on public.projects for select to authenticated
using (
  (((select public.current_role()) = 'admin') or deleted_at is null)
  and private.can_access_project(id)
);

drop view if exists public.vendors_public;
create view public.vendors_public
with (security_invoker = true, security_barrier = true)
as
select
  v.id, v.name, v.biz_no, v.ceo, v.address, v.category, v.homepage,
  v.status, v.memo, v.created_at, v.updated_at, v.created_by, v.deleted_at
from public.vendors v
where v.deleted_at is null;

drop view if exists public.projects_public;
create view public.projects_public
with (security_invoker = true, security_barrier = true)
as
select
  p.id, p.title, p.category, p.description, p.budget, p.stage,
  p.owner_user_id, p.board_resolution, p.selected_vendor_id, p.selection_reason,
  p.created_at, p.updated_at, p.created_by, p.deleted_at,
  p.business_project_id
from public.projects p
where p.deleted_at is null;

revoke all on public.vendors_public, public.projects_public from public, anon;
grant select on public.vendors_public, public.projects_public to authenticated, service_role;

create policy contract_amendments_select on public.contract_amendments for select to authenticated
using (
  (((select public.current_role()) = 'admin') or deleted_at is null)
  and exists (
    select 1 from public.contracts c
    where c.id = contract_id and private.can_access_project(c.project_id)
  )
);
create policy contract_amendments_insert on public.contract_amendments for insert to authenticated
with check (
  (select public.current_role()) in ('admin', 'staff', 'agent')
  and exists (
    select 1 from public.contracts c
    where c.id = contract_id and private.can_write_project(c.project_id)
  )
);
create policy contract_amendments_update on public.contract_amendments for update to authenticated
using (
  (select public.current_role()) in ('admin', 'staff')
  and approval_status in ('draft', 'requested', 'rejected')
  and exists (
    select 1 from public.contracts c
    where c.id = contract_id and private.can_write_project(c.project_id)
  )
)
with check (
  (select public.current_role()) in ('admin', 'staff')
  and exists (
    select 1 from public.contracts c
    where c.id = contract_id and private.can_write_project(c.project_id)
  )
);
create policy contract_amendments_delete on public.contract_amendments for delete to authenticated
using ((select public.current_role()) = 'admin' and approval_status <> 'approved');

create policy approval_requests_select on public.approval_requests for select to authenticated
using (
  (((select public.current_role()) = 'admin') or deleted_at is null)
  and private.can_access_project(project_id)
);
create policy approval_requests_insert on public.approval_requests for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and created_by = (select auth.uid())
  and (select public.current_role()) in ('admin', 'staff')
  and private.can_write_project(project_id)
);

create policy project_internal_notes_select on public.project_internal_notes for select to authenticated
using (
  deleted_at is null
  and (select public.current_role()) in ('admin', 'executive', 'staff')
);
create policy project_internal_notes_insert on public.project_internal_notes for insert to authenticated
with check (
  (select public.current_role()) in ('admin', 'staff')
  and created_by = (select auth.uid())
);
create policy project_internal_notes_update on public.project_internal_notes for update to authenticated
using ((select public.current_role()) in ('admin', 'staff'))
with check ((select public.current_role()) in ('admin', 'staff'));
create policy project_internal_notes_delete on public.project_internal_notes for delete to authenticated
using ((select public.current_role()) = 'admin');

create policy vendor_internal_notes_select on public.vendor_internal_notes for select to authenticated
using (
  deleted_at is null
  and (select public.current_role()) in ('admin', 'executive', 'staff')
);
create policy vendor_internal_notes_insert on public.vendor_internal_notes for insert to authenticated
with check (
  (select public.current_role()) in ('admin', 'staff')
  and created_by = (select auth.uid())
);
create policy vendor_internal_notes_update on public.vendor_internal_notes for update to authenticated
using ((select public.current_role()) in ('admin', 'staff'))
with check ((select public.current_role()) in ('admin', 'staff'));
create policy vendor_internal_notes_delete on public.vendor_internal_notes for delete to authenticated
using ((select public.current_role()) = 'admin');

create policy vendor_financial_details_select on public.vendor_financial_details for select to authenticated
using (
  deleted_at is null
  and (select public.current_role()) in ('admin', 'executive', 'staff')
);
create policy vendor_financial_details_insert on public.vendor_financial_details for insert to authenticated
with check (
  (select public.current_role()) in ('admin', 'staff')
  and created_by = (select auth.uid())
);
create policy vendor_financial_details_update on public.vendor_financial_details for update to authenticated
using ((select public.current_role()) in ('admin', 'staff'))
with check ((select public.current_role()) in ('admin', 'staff'));
create policy vendor_financial_details_delete on public.vendor_financial_details for delete to authenticated
using ((select public.current_role()) = 'admin');

create policy erp_sync_outbox_select on public.erp_sync_outbox for select to authenticated
using ((select public.current_role()) in ('admin', 'executive', 'staff'));

-- The audit log is append-only for every interactive role. Retention or
-- archival must be performed through controlled service-role operations.
drop policy if exists audit_logs_delete on public.audit_logs;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
using (
  deleted_at is null
  and (select public.current_role()) in ('admin', 'executive', 'staff')
);

-- Agents may prepare assigned work, but financial state and final evaluations
-- are controlled by admin/staff. Executives approve through a dedicated RPC.
drop policy if exists contracts_update on public.contracts;
create policy contracts_update on public.contracts for update to authenticated
using (
  (select public.current_role()) in ('admin', 'staff')
  and private.can_write_project(project_id)
)
with check (
  (select public.current_role()) in ('admin', 'staff')
  and private.can_write_project(project_id)
);

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
using ((select public.current_role()) in ('admin', 'staff'))
with check ((select public.current_role()) in ('admin', 'staff'));

drop policy if exists vendors_update on public.vendors;
create policy vendors_update on public.vendors for update to authenticated
using ((select public.current_role()) in ('admin', 'staff'))
with check ((select public.current_role()) in ('admin', 'staff'));

drop policy if exists project_vendors_update on public.project_vendors;
create policy project_vendors_update on public.project_vendors for update to authenticated
using (
  (select public.current_role()) in ('admin', 'staff')
  and private.can_write_project(project_id)
)
with check (
  (select public.current_role()) in ('admin', 'staff')
  and private.can_write_project(project_id)
);

drop policy if exists payment_schedules_insert on public.payment_schedules;
drop policy if exists payment_schedules_update on public.payment_schedules;
create policy payment_schedules_insert on public.payment_schedules for insert to authenticated
with check (
  (
    (select public.current_role()) in ('admin', 'staff')
    or exists (
      select 1 from public.contracts own_contract
      where own_contract.id = contract_id
        and own_contract.created_by = (select auth.uid())
        and own_contract.approval_status in ('draft', 'requested')
    )
  )
  and exists (
    select 1 from public.contracts c
    where c.id = contract_id and private.can_write_project(c.project_id)
  )
);
create policy payment_schedules_update on public.payment_schedules for update to authenticated
using (
  (select public.current_role()) in ('admin', 'staff')
  and exists (
    select 1 from public.contracts c
    where c.id = contract_id and private.can_write_project(c.project_id)
  )
)
with check (
  (select public.current_role()) in ('admin', 'staff')
  and exists (
    select 1 from public.contracts c
    where c.id = contract_id and private.can_write_project(c.project_id)
  )
);

drop policy if exists vendor_reviews_insert on public.vendor_reviews;
drop policy if exists vendor_reviews_update on public.vendor_reviews;
create policy vendor_reviews_insert on public.vendor_reviews for insert to authenticated
with check (
  (select public.current_role()) in ('admin', 'staff')
  and private.can_write_project(project_id)
);
create policy vendor_reviews_update on public.vendor_reviews for update to authenticated
using (
  (select public.current_role()) in ('admin', 'staff')
  and private.can_write_project(project_id)
)
with check (
  (select public.current_role()) in ('admin', 'staff')
  and private.can_write_project(project_id)
);

-- Source-generated events are read-only through the Data API. Their privileged
-- trigger functions keep them synchronized from contracts/payments/actions.
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
using (source_type is null and private.can_write_project(project_id))
with check (source_type is null and private.can_write_project(project_id));

create or replace function public.request_vendor_selection(
  target_project_id uuid,
  target_vendor_id uuid,
  selection_reason_value text,
  board_resolution_value text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_id uuid;
begin
  if (select auth.uid()) is null
    or (select public.current_role()) not in ('admin', 'staff')
    or not private.can_write_project(target_project_id) then
    raise exception '업체 선정안을 요청할 권한이 없습니다.' using errcode = '42501';
  end if;
  if nullif(trim(selection_reason_value), '') is null
    or nullif(trim(board_resolution_value), '') is null then
    raise exception '선정 사유와 이사회 회차·일자를 입력해 주세요.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.project_vendors
    where project_id = target_project_id
      and vendor_id = target_vendor_id
      and deleted_at is null
  ) then
    raise exception '해당 용역 건의 참여 업체가 아닙니다.' using errcode = '22023';
  end if;

  insert into public.approval_requests (
    target_type, target_id, project_id, title, snapshot,
    requested_by, created_by
  )
  select
    'vendor_selection', target_project_id, target_project_id,
    p.title || ' 업체 선정',
    jsonb_build_object(
      'vendor_id', target_vendor_id,
      'selection_reason', trim(selection_reason_value),
      'board_resolution', trim(board_resolution_value)
    ),
    (select auth.uid()), (select auth.uid())
  from public.projects p
  where p.id = target_project_id and p.deleted_at is null
  returning id into request_id;

  if request_id is null then
    raise exception '용역 건을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  return request_id;
end;
$$;

create or replace function public.save_vendor_with_sensitive(
  vendor_id_value uuid default null,
  name_value text default null,
  biz_no_value text default null,
  ceo_value text default null,
  address_value text default null,
  category_value text default null,
  homepage_value text default null,
  status_value public.vendor_status default null,
  memo_value text default null,
  bank_name_value text default null,
  bank_account_value text default null,
  internal_note_value text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  saved_vendor_id uuid;
begin
  if actor_id is null or (select public.current_role()) not in ('admin', 'staff') then
    raise exception '업체 정보를 저장할 권한이 없습니다.' using errcode = '42501';
  end if;
  if nullif(trim(name_value), '') is null
    or nullif(trim(category_value), '') is null
    or status_value is null then
    raise exception '상호와 분야를 입력해 주세요.' using errcode = '22023';
  end if;

  if vendor_id_value is null then
    insert into public.vendors (
      name, biz_no, ceo, address, category, homepage, status, memo, created_by
    ) values (
      trim(name_value), nullif(trim(biz_no_value), ''), nullif(trim(ceo_value), ''),
      nullif(trim(address_value), ''), trim(category_value), nullif(trim(homepage_value), ''),
      status_value, nullif(trim(memo_value), ''), actor_id
    ) returning id into saved_vendor_id;
  else
    update public.vendors
    set name = trim(name_value),
        biz_no = nullif(trim(biz_no_value), ''),
        ceo = nullif(trim(ceo_value), ''),
        address = nullif(trim(address_value), ''),
        category = trim(category_value),
        homepage = nullif(trim(homepage_value), ''),
        status = status_value,
        memo = nullif(trim(memo_value), '')
    where id = vendor_id_value and deleted_at is null
    returning id into saved_vendor_id;
    if saved_vendor_id is null then
      raise exception '업체를 찾을 수 없습니다.' using errcode = 'P0002';
    end if;
  end if;

  if nullif(trim(bank_name_value), '') is null
    and nullif(trim(bank_account_value), '') is null then
    update public.vendor_financial_details
    set deleted_at = now()
    where vendor_id = saved_vendor_id and deleted_at is null;
  else
    insert into public.vendor_financial_details (
      vendor_id, bank_name, bank_account, created_by
    ) values (
      saved_vendor_id, nullif(trim(bank_name_value), ''),
      nullif(trim(bank_account_value), ''), actor_id
    )
    on conflict (vendor_id) where deleted_at is null
    do update set
      bank_name = excluded.bank_name,
      bank_account = excluded.bank_account;
  end if;

  if nullif(trim(internal_note_value), '') is null then
    update public.vendor_internal_notes
    set deleted_at = now()
    where vendor_id = saved_vendor_id and deleted_at is null;
  else
    insert into public.vendor_internal_notes (
      vendor_id, content, created_by
    ) values (
      saved_vendor_id, trim(internal_note_value), actor_id
    )
    on conflict (vendor_id) where deleted_at is null
    do update set content = excluded.content;
  end if;

  return saved_vendor_id;
end;
$$;

-- Replace delta-based contract creation. A root contract and every amendment
-- are submitted for approval; amendments store their final post-change value.
create or replace function public.create_contract_with_payments(
  project_id_value uuid,
  vendor_id_value uuid,
  title_value text,
  signed_at_value date,
  start_at_value date,
  end_at_value date,
  amount_value bigint,
  vat_value bigint,
  contract_party_value text,
  original_location_value text,
  is_sealed_value boolean,
  parent_contract_id_value uuid default null,
  change_reason_value text default null,
  payment_rows jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.user_role := (select public.current_role());
  contract_id_value uuid;
  amendment_id_value uuid;
  payment_row jsonb;
  payment_seq integer := 0;
  parent_row public.contracts%rowtype;
  amendment_sequence integer;
begin
  if actor_id is null
    or actor_role not in ('admin', 'staff', 'agent')
    or not private.can_write_project(project_id_value) then
    raise exception '계약 승인안을 등록할 권한이 없습니다.' using errcode = '42501';
  end if;
  if nullif(trim(title_value), '') is null then
    raise exception '계약명을 입력해 주세요.' using errcode = '22023';
  end if;
  if start_at_value > end_at_value then
    raise exception '종료일은 시작일보다 빠를 수 없습니다.' using errcode = '22023';
  end if;
  if amount_value < 0 or vat_value < 0 then
    raise exception '계약 금액은 0원 이상이어야 합니다.' using errcode = '22023';
  end if;
  if contract_party_value not in ('조합직접', '업무대행사대행') then
    raise exception '계약 주체를 확인해 주세요.' using errcode = '22023';
  end if;
  if jsonb_typeof(payment_rows) <> 'array' then
    raise exception '지급 회차 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.project_vendors
    where project_id = project_id_value
      and vendor_id = vendor_id_value
      and deleted_at is null
  ) then
    raise exception '해당 용역 건의 참여 업체가 아닙니다.' using errcode = '22023';
  end if;

  if parent_contract_id_value is null then
    insert into public.contracts (
      project_id, vendor_id, title, signed_at, start_at, end_at,
      amount, vat, contract_party, original_location, is_sealed,
      approval_status, created_by
    ) values (
      project_id_value, vendor_id_value, trim(title_value), signed_at_value,
      start_at_value, end_at_value, amount_value, vat_value,
      contract_party_value, nullif(trim(original_location_value), ''),
      is_sealed_value,
      case when actor_role = 'agent' then 'draft'::public.approval_status else 'requested'::public.approval_status end,
      actor_id
    ) returning id into contract_id_value;

    for payment_row in select value from jsonb_array_elements(payment_rows) loop
      payment_seq := payment_seq + 1;
      if nullif(trim(payment_row->>'label'), '') is null
        or nullif(payment_row->>'due_date', '') is null
        or coalesce((payment_row->>'amount')::bigint, -1) < 0 then
        raise exception '지급 회차 %의 내용을 확인해 주세요.', payment_seq using errcode = '22023';
      end if;
      insert into public.payment_schedules (
        contract_id, seq, label, due_date, amount, created_by
      ) values (
        contract_id_value, payment_seq, trim(payment_row->>'label'),
        (payment_row->>'due_date')::date, (payment_row->>'amount')::bigint, actor_id
      );
    end loop;

    if actor_role in ('admin', 'staff') then
      insert into public.approval_requests (
        target_type, target_id, project_id, title, snapshot,
        requested_by, created_by
      ) values (
        'contract', contract_id_value, project_id_value,
        trim(title_value) || ' 계약 승인',
        jsonb_build_object(
          'vendor_id', vendor_id_value,
          'amount', amount_value,
          'vat', vat_value,
          'signed_at', signed_at_value,
          'start_at', start_at_value,
          'end_at', end_at_value,
          'contract_party', contract_party_value
        ),
        actor_id, actor_id
      );
    end if;
    return contract_id_value;
  end if;

  select * into parent_row
  from public.contracts
  where id = parent_contract_id_value
    and parent_contract_id is null
    and deleted_at is null
    and approval_status = 'approved';
  if not found
    or parent_row.project_id <> project_id_value
    or parent_row.vendor_id <> vendor_id_value then
    raise exception '승인된 원계약 연결 정보를 확인해 주세요.' using errcode = '22023';
  end if;
  if nullif(trim(change_reason_value), '') is null then
    raise exception '변경 사유를 입력해 주세요.' using errcode = '22023';
  end if;
  if amount_value = parent_row.amount and vat_value = parent_row.vat
    and start_at_value = parent_row.start_at and end_at_value = parent_row.end_at then
    raise exception '금액 또는 계약기간 변경 내용을 입력해 주세요.' using errcode = '22023';
  end if;

  select coalesce(max(sequence), 0) + 1
  into amendment_sequence
  from public.contract_amendments
  where contract_id = parent_row.id and deleted_at is null;

  insert into public.contract_amendments (
    contract_id, sequence, title, signed_at, start_at, end_at,
    previous_amount, previous_vat, final_amount, final_vat,
    change_reason, original_location, is_sealed, approval_status,
    created_by
  ) values (
    parent_row.id, amendment_sequence, trim(title_value), signed_at_value,
    start_at_value, end_at_value, parent_row.amount, parent_row.vat,
    amount_value, vat_value, trim(change_reason_value),
    nullif(trim(original_location_value), ''), is_sealed_value,
    case when actor_role = 'agent' then 'draft'::public.approval_status else 'requested'::public.approval_status end,
    actor_id
  ) returning id into amendment_id_value;

  if actor_role in ('admin', 'staff') then
    insert into public.approval_requests (
      target_type, target_id, project_id, title, snapshot,
      requested_by, created_by
    ) values (
      'contract_amendment', amendment_id_value, project_id_value,
      trim(title_value) || ' 변경계약 승인',
      jsonb_build_object(
        'contract_id', parent_row.id,
        'previous_amount', parent_row.amount,
        'previous_vat', parent_row.vat,
        'final_amount', amount_value,
        'final_vat', vat_value,
        'signed_at', signed_at_value,
        'start_at', start_at_value,
        'end_at', end_at_value,
        'change_reason', trim(change_reason_value)
      ),
      actor_id, actor_id
    );
  end if;
  return parent_row.id;
end;
$$;

create or replace function public.submit_contract_approval(
  target_type_value public.approval_target_type,
  target_id_value uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_id uuid;
  contract_row public.contracts%rowtype;
  amendment_row public.contract_amendments%rowtype;
begin
  if actor_id is null or (select public.current_role()) not in ('admin', 'staff') then
    raise exception '계약 승인요청 권한이 없습니다.' using errcode = '42501';
  end if;
  if target_type_value = 'contract' then
    select * into contract_row from public.contracts
    where id = target_id_value
      and parent_contract_id is null
      and deleted_at is null
      and approval_status in ('draft', 'rejected')
    for update;
    if not found or not private.can_write_project(contract_row.project_id) then
      raise exception '승인요청할 계약을 찾을 수 없습니다.' using errcode = 'P0002';
    end if;
    update public.contracts set approval_status = 'requested' where id = contract_row.id;
    insert into public.approval_requests (
      target_type, target_id, project_id, title, snapshot,
      requested_by, created_by
    ) values (
      'contract', contract_row.id, contract_row.project_id,
      contract_row.title || ' 계약 승인',
      jsonb_build_object(
        'vendor_id', contract_row.vendor_id,
        'amount', contract_row.amount,
        'vat', contract_row.vat,
        'signed_at', contract_row.signed_at,
        'start_at', contract_row.start_at,
        'end_at', contract_row.end_at,
        'contract_party', contract_row.contract_party
      ),
      actor_id, actor_id
    ) returning id into request_id;
    return request_id;
  end if;

  if target_type_value <> 'contract_amendment' then
    raise exception '계약 또는 변경계약만 요청할 수 있습니다.' using errcode = '22023';
  end if;
  select amendment.* into amendment_row
  from public.contract_amendments amendment
  join public.contracts contract on contract.id = amendment.contract_id
  where amendment.id = target_id_value
    and amendment.deleted_at is null
    and amendment.approval_status in ('draft', 'rejected')
    and private.can_write_project(contract.project_id)
  for update of amendment;
  if not found then
    raise exception '승인요청할 변경계약을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  update public.contract_amendments set approval_status = 'requested'
  where id = amendment_row.id;
  insert into public.approval_requests (
    target_type, target_id, project_id, title, snapshot,
    requested_by, created_by
  )
  select
    'contract_amendment', amendment_row.id, contract.project_id,
    amendment_row.title || ' 변경계약 승인',
    jsonb_build_object(
      'contract_id', amendment_row.contract_id,
      'previous_amount', amendment_row.previous_amount,
      'previous_vat', amendment_row.previous_vat,
      'final_amount', amendment_row.final_amount,
      'final_vat', amendment_row.final_vat,
      'signed_at', amendment_row.signed_at,
      'start_at', amendment_row.start_at,
      'end_at', amendment_row.end_at,
      'change_reason', amendment_row.change_reason
    ),
    actor_id, actor_id
  from public.contracts contract
  where contract.id = amendment_row.contract_id
  returning id into request_id;
  return request_id;
end;
$$;

create or replace function private.decide_approval(
  approval_id_value uuid,
  decision_value public.approval_status,
  decision_reason_value text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.user_role := (select public.current_role());
  approval_row public.approval_requests%rowtype;
  contract_row public.contracts%rowtype;
  amendment_row public.contract_amendments%rowtype;
  vendor_id_value uuid;
begin
  if actor_id is null or actor_role not in ('admin', 'executive') then
    raise exception '승인·반려 권한이 없습니다.' using errcode = '42501';
  end if;
  if decision_value not in ('approved', 'rejected') then
    raise exception '승인 또는 반려만 처리할 수 있습니다.' using errcode = '22023';
  end if;
  if decision_value = 'rejected'
    and nullif(trim(decision_reason_value), '') is null then
    raise exception '반려 사유를 입력해 주세요.' using errcode = '22023';
  end if;

  select * into approval_row
  from public.approval_requests
  where id = approval_id_value
    and status = 'requested'
    and deleted_at is null
  for update;
  if not found then
    raise exception '처리할 승인 요청을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if actor_role <> 'admin' and approval_row.requested_by = actor_id then
    raise exception '본인이 요청한 건은 직접 승인할 수 없습니다.' using errcode = '42501';
  end if;

  update public.approval_requests
  set status = decision_value,
      decided_by = actor_id,
      decided_at = now(),
      decision_reason = nullif(trim(decision_reason_value), '')
  where id = approval_row.id;

  if approval_row.target_type = 'vendor_selection' then
    if decision_value = 'approved' then
      vendor_id_value := (approval_row.snapshot->>'vendor_id')::uuid;
      update public.project_vendors
      set role = case when vendor_id = vendor_id_value then '선정' else '탈락' end,
          reason = case
            when vendor_id = vendor_id_value then approval_row.snapshot->>'selection_reason'
            else coalesce(reason, '미선정')
          end
      where project_id = approval_row.project_id and deleted_at is null;
      update public.vendors set status = '선정'
      where id = vendor_id_value and deleted_at is null;
      update public.projects
      set selected_vendor_id = vendor_id_value,
          selection_reason = approval_row.snapshot->>'selection_reason',
          board_resolution = approval_row.snapshot->>'board_resolution',
          stage = '선정'
      where id = approval_row.project_id and deleted_at is null;
    end if;
    return;
  end if;

  if approval_row.target_type = 'contract' then
    select * into contract_row from public.contracts
    where id = approval_row.target_id and deleted_at is null for update;
    if not found then
      raise exception '계약을 찾을 수 없습니다.' using errcode = 'P0002';
    end if;
    update public.contracts
    set approval_status = decision_value,
        approved_by = case when decision_value = 'approved' then actor_id else null end,
        approved_at = case when decision_value = 'approved' then now() else null end
    where id = contract_row.id;
    if decision_value = 'approved' then
      update public.projects set stage = '계약' where id = contract_row.project_id;
      update public.vendors set status = '계약중' where id = contract_row.vendor_id;
      update public.payment_schedules
      set updated_at = now()
      where contract_id = contract_row.id and deleted_at is null;
      insert into public.erp_sync_outbox (
        aggregate_type, aggregate_id, event_type, payload, created_by
      ) values (
        'contract', contract_row.id, 'approved',
        jsonb_build_object(
          'source_system', 'DBapt-Vendor',
          'source_contract_id', contract_row.id,
          'project_id', contract_row.project_id,
          'vendor_id', contract_row.vendor_id,
          'title', contract_row.title,
          'signed_at', contract_row.signed_at,
          'start_at', contract_row.start_at,
          'end_at', contract_row.end_at,
          'supply_amount', contract_row.amount,
          'vat', contract_row.vat,
          'total_amount', contract_row.amount + contract_row.vat,
          'payment_schedules', coalesce((
            select jsonb_agg(jsonb_build_object(
              'source_payment_id', ps.id,
              'sequence', ps.seq,
              'label', ps.label,
              'due_date', ps.due_date,
              'amount', ps.amount
            ) order by ps.seq)
            from public.payment_schedules ps
            where ps.contract_id = contract_row.id and ps.deleted_at is null
          ), '[]'::jsonb)
        ),
        actor_id
      ) on conflict (aggregate_type, aggregate_id, event_type)
        where deleted_at is null do nothing;
    end if;
    return;
  end if;

  select * into amendment_row from public.contract_amendments
  where id = approval_row.target_id and deleted_at is null for update;
  if not found then
    raise exception '변경계약을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  update public.contract_amendments
  set approval_status = decision_value,
      approved_by = case when decision_value = 'approved' then actor_id else null end,
      approved_at = case when decision_value = 'approved' then now() else null end
  where id = amendment_row.id;
  if decision_value = 'approved' then
    update public.contracts
    set amount = amendment_row.final_amount,
        vat = amendment_row.final_vat,
        start_at = amendment_row.start_at,
        end_at = amendment_row.end_at,
        original_location = coalesce(amendment_row.original_location, original_location),
        is_sealed = amendment_row.is_sealed
    where id = amendment_row.contract_id;
    insert into public.erp_sync_outbox (
      aggregate_type, aggregate_id, event_type, payload, created_by
    ) values (
      'contract_amendment', amendment_row.id, 'approved',
      jsonb_build_object(
        'source_system', 'DBapt-Vendor',
        'source_amendment_id', amendment_row.id,
        'source_contract_id', amendment_row.contract_id,
        'sequence', amendment_row.sequence,
        'title', amendment_row.title,
        'signed_at', amendment_row.signed_at,
        'previous_supply_amount', amendment_row.previous_amount,
        'previous_vat', amendment_row.previous_vat,
        'final_supply_amount', amendment_row.final_amount,
        'final_vat', amendment_row.final_vat,
        'supply_delta', amendment_row.final_amount - amendment_row.previous_amount,
        'vat_delta', amendment_row.final_vat - amendment_row.previous_vat,
        'change_reason', amendment_row.change_reason
      ),
      actor_id
    ) on conflict (aggregate_type, aggregate_id, event_type)
      where deleted_at is null do nothing;
  end if;
end;
$$;

create or replace function public.decide_approval(
  approval_id_value uuid,
  decision_value public.approval_status,
  decision_reason_value text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.decide_approval(approval_id_value, decision_value, decision_reason_value)
$$;

revoke all on function public.request_vendor_selection(uuid, uuid, text, text) from public, anon;
grant execute on function public.request_vendor_selection(uuid, uuid, text, text) to authenticated, service_role;
revoke all on function public.save_vendor_with_sensitive(
  uuid, text, text, text, text, text, text, public.vendor_status,
  text, text, text, text
) from public, anon;
grant execute on function public.save_vendor_with_sensitive(
  uuid, text, text, text, text, text, text, public.vendor_status,
  text, text, text, text
) to authenticated, service_role;
revoke all on function public.submit_contract_approval(public.approval_target_type, uuid) from public, anon;
grant execute on function public.submit_contract_approval(public.approval_target_type, uuid) to authenticated, service_role;
revoke execute on function public.select_project_vendor(uuid, uuid, text, text) from authenticated;
revoke all on function private.decide_approval(uuid, public.approval_status, text) from public, anon;
grant execute on function private.decide_approval(uuid, public.approval_status, text) to authenticated, service_role;
revoke all on function public.decide_approval(uuid, public.approval_status, text) from public, anon;
grant execute on function public.decide_approval(uuid, public.approval_status, text) to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'contract_amendments', 'approval_requests',
    'project_internal_notes', 'vendor_internal_notes',
    'vendor_financial_details', 'erp_sync_outbox'
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

comment on table public.approval_requests is '업체선정·원계약·변경계약 승인 요청과 결정 이력';
comment on table public.contract_amendments is '변경 후 최종 금액을 저장하는 변경계약 이력';
comment on table public.erp_sync_outbox is '승인 완료 데이터를 ERP로 전달하기 위한 ID 기반 연동 대기함';
comment on table public.project_internal_notes is 'admin/executive/staff 전용 용역 내부 메모';
comment on table public.vendor_internal_notes is 'admin/executive/staff 전용 업체 내부 메모';
comment on table public.vendor_financial_details is 'admin/executive/staff 전용 업체 금융정보';
comment on column public.contracts.amount is '현재 승인된 공급가액(원). 계약총액은 amount + vat.';
comment on column public.contracts.vat is '현재 승인된 부가가치세(원).';
