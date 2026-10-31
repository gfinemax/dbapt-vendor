-- 문서 원본, AI 분석 결과, 검토·반영 이력을 분리해 보존한다.
-- 상위 프로젝트에서 용역건 생성 전 문서를 받을 수 있도록 business_project 소유자를 추가한다.

alter table public.documents
  add column mime_type text,
  add column file_size bigint;

alter table public.documents
  drop constraint documents_owner_type_check,
  add constraint documents_owner_type_check
    check (owner_type in ('business_project', 'vendor', 'project', 'quote', 'contract', 'meeting')),
  add constraint documents_file_size_nonnegative
    check (file_size is null or file_size >= 0);

create or replace function private.can_write_business_project(target_business_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select public.current_role()) in ('admin', 'staff')
    and exists (
      select 1
      from public.business_projects business_project
      where business_project.id = target_business_project_id
        and business_project.deleted_at is null
    )
$$;

revoke all on function private.can_write_business_project(uuid) from public, anon;
grant execute on function private.can_write_business_project(uuid) to authenticated, service_role;

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
  if owner_type = 'business_project' then
    return case when write_access
      then private.can_write_business_project(owner_id)
      else private.can_access_business_project(owner_id)
    end;
  end if;

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

create table public.document_analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete restrict,
  status text not null default 'queued',
  detected_kind text,
  summary text,
  extracted_data jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  confidence numeric(5, 4),
  model text,
  schema_version text not null default 'document-intelligence-v1',
  source_hash text,
  error_message text,
  analyzed_at timestamptz,
  applied_project_id uuid references public.projects(id) on delete restrict,
  applied_owner_type text,
  applied_owner_id uuid,
  applied_at timestamptz,
  applied_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint document_analyses_document_unique unique (document_id),
  constraint document_analyses_status_check
    check (status in ('queued', 'analyzing', 'review_required', 'applied', 'failed')),
  constraint document_analyses_kind_check
    check (detected_kind is null or detected_kind in ('사업자등록증', '견적서', '제안서', '계약서', '변경계약서', '보증증권', '회의자료', '공문', '기타')),
  constraint document_analyses_confidence_range
    check (confidence is null or confidence between 0 and 1),
  constraint document_analyses_extracted_object
    check (jsonb_typeof(extracted_data) = 'object'),
  constraint document_analyses_evidence_array
    check (jsonb_typeof(evidence) = 'array'),
  constraint document_analyses_applied_owner_pair
    check ((applied_owner_type is null) = (applied_owner_id is null)),
  constraint document_analyses_applied_owner_type
    check (applied_owner_type is null or applied_owner_type in ('project', 'quote', 'contract', 'vendor', 'meeting'))
);

create index document_analyses_status_idx
  on public.document_analyses (status, created_at desc)
  where deleted_at is null;
create index document_analyses_applied_project_idx
  on public.document_analyses (applied_project_id, created_at desc)
  where deleted_at is null and applied_project_id is not null;

create trigger document_analyses_set_updated_at
before update on public.document_analyses
for each row execute function private.set_updated_at();

create trigger document_analyses_audit
after insert or update or delete on public.document_analyses
for each row execute function private.write_audit_log();

alter table public.document_analyses enable row level security;
revoke all on public.document_analyses from anon;
grant select, insert, update, delete on public.document_analyses to authenticated, service_role;

create policy document_analyses_select on public.document_analyses
for select to authenticated
using (
  (((select public.current_role()) = 'admin') or deleted_at is null)
  and exists (
    select 1
    from public.documents document
    where document.id = document_id
      and private.can_access_owner(document.owner_type, document.owner_id, false)
  )
);

create policy document_analyses_insert on public.document_analyses
for insert to authenticated
with check (
  exists (
    select 1
    from public.documents document
    where document.id = document_id
      and private.can_access_owner(document.owner_type, document.owner_id, true)
  )
);

create policy document_analyses_update on public.document_analyses
for update to authenticated
using (
  exists (
    select 1
    from public.documents document
    where document.id = document_id
      and private.can_access_owner(document.owner_type, document.owner_id, true)
  )
)
with check (
  exists (
    select 1
    from public.documents document
    where document.id = document_id
      and private.can_access_owner(document.owner_type, document.owner_id, true)
  )
);

create policy document_analyses_delete on public.document_analyses
for delete to authenticated
using ((select public.current_role()) = 'admin');

create or replace function public.create_service_case_from_documents(
  business_project_id_value uuid,
  title_value text,
  category_value public.project_category,
  description_value text,
  budget_value bigint,
  stage_value public.project_stage,
  owner_user_id_value uuid,
  document_ids_value uuid[],
  quote_rows jsonb default '[]'::jsonb,
  contract_rows jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.user_role := (select public.current_role());
  service_case_id uuid;
  document_id_value uuid;
  row_value jsonb;
  vendor_id_value uuid;
  quote_id_value uuid;
  contract_id_value uuid;
  version_value integer;
begin
  if actor_id is null
    or actor_role not in ('admin', 'staff')
    or not private.can_write_business_project(business_project_id_value) then
    raise exception '문서에서 용역건을 등록할 권한이 없습니다.' using errcode = '42501';
  end if;
  if nullif(trim(title_value), '') is null then
    raise exception '용역명을 입력해 주세요.' using errcode = '22023';
  end if;
  if budget_value < 0 then
    raise exception '예산은 0원 이상이어야 합니다.' using errcode = '22023';
  end if;
  if coalesce(cardinality(document_ids_value), 0) = 0
    or jsonb_typeof(quote_rows) <> 'array'
    or jsonb_typeof(contract_rows) <> 'array' then
    raise exception '반영할 문서 정보를 확인해 주세요.' using errcode = '22023';
  end if;

  foreach document_id_value in array document_ids_value loop
    if not exists (
      select 1
      from public.documents document
      join public.document_analyses analysis on analysis.document_id = document.id
      where document.id = document_id_value
        and document.owner_type = 'business_project'
        and document.owner_id = business_project_id_value
        and document.deleted_at is null
        and analysis.deleted_at is null
        and analysis.status = 'review_required'
    ) then
      raise exception '검토 가능한 프로젝트 문서를 찾을 수 없습니다.' using errcode = '22023';
    end if;
  end loop;

  insert into public.projects (
    business_project_id, title, category, description, budget, stage,
    owner_user_id, created_by
  ) values (
    business_project_id_value, trim(title_value), category_value,
    nullif(trim(description_value), ''), budget_value, stage_value,
    owner_user_id_value, actor_id
  ) returning id into service_case_id;

  for row_value in select value from jsonb_array_elements(quote_rows) loop
    document_id_value := (row_value->>'document_id')::uuid;
    vendor_id_value := (row_value->>'vendor_id')::uuid;
    if not (document_id_value = any(document_ids_value)) then
      raise exception '견적서 연결 정보를 확인해 주세요.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.vendors where id = vendor_id_value and deleted_at is null) then
      raise exception '견적 업체를 찾을 수 없습니다.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.project_vendors
      where project_id = service_case_id and vendor_id = vendor_id_value and deleted_at is null
    ) then
      insert into public.project_vendors (project_id, vendor_id, role, created_by)
      values (service_case_id, vendor_id_value, '후보', actor_id);
    end if;
    select coalesce(max(version), 0) + 1 into version_value
    from public.quotes
    where project_id = service_case_id and vendor_id = vendor_id_value and deleted_at is null;

    insert into public.quotes (
      project_id, vendor_id, version, received_at, amount, vat_included,
      duration_days, warranty_months, payment_terms, items, note, created_by
    ) values (
      service_case_id, vendor_id_value, version_value,
      (row_value->>'received_at')::date,
      (row_value->>'amount')::bigint,
      coalesce((row_value->>'vat_included')::boolean, true),
      nullif(row_value->>'duration_days', '')::integer,
      nullif(row_value->>'warranty_months', '')::integer,
      nullif(trim(row_value->>'payment_terms'), ''),
      coalesce(row_value->'items', '[]'::jsonb),
      nullif(trim(row_value->>'note'), ''),
      actor_id
    ) returning id into quote_id_value;

    update public.document_analyses set
      status = 'applied', applied_project_id = service_case_id,
      applied_owner_type = 'quote', applied_owner_id = quote_id_value,
      applied_at = now(), applied_by = actor_id,
      reviewed_at = now(), reviewed_by = actor_id
    where document_id = document_id_value and deleted_at is null;
  end loop;

  for row_value in select value from jsonb_array_elements(contract_rows) loop
    document_id_value := (row_value->>'document_id')::uuid;
    vendor_id_value := (row_value->>'vendor_id')::uuid;
    if not (document_id_value = any(document_ids_value)) then
      raise exception '계약서 연결 정보를 확인해 주세요.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.vendors where id = vendor_id_value and deleted_at is null) then
      raise exception '계약 업체를 찾을 수 없습니다.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.project_vendors
      where project_id = service_case_id and vendor_id = vendor_id_value and deleted_at is null
    ) then
      insert into public.project_vendors (project_id, vendor_id, role, created_by)
      values (service_case_id, vendor_id_value, '후보', actor_id);
    end if;

    contract_id_value := public.create_contract_with_payments(
      service_case_id,
      vendor_id_value,
      row_value->>'title',
      (row_value->>'signed_at')::date,
      (row_value->>'start_at')::date,
      (row_value->>'end_at')::date,
      (row_value->>'amount')::bigint,
      (row_value->>'vat')::bigint,
      row_value->>'contract_party',
      '',
      coalesce((row_value->>'is_sealed')::boolean, false),
      null,
      null,
      coalesce(row_value->'payments', '[]'::jsonb)
    );

    update public.document_analyses set
      status = 'applied', applied_project_id = service_case_id,
      applied_owner_type = 'contract', applied_owner_id = contract_id_value,
      applied_at = now(), applied_by = actor_id,
      reviewed_at = now(), reviewed_by = actor_id
    where document_id = document_id_value and deleted_at is null;
  end loop;

  update public.document_analyses set
    status = 'applied', applied_project_id = service_case_id,
    applied_owner_type = coalesce(applied_owner_type, 'project'),
    applied_owner_id = coalesce(applied_owner_id, service_case_id),
    applied_at = coalesce(applied_at, now()),
    applied_by = coalesce(applied_by, actor_id),
    reviewed_at = coalesce(reviewed_at, now()),
    reviewed_by = coalesce(reviewed_by, actor_id)
  where document_id = any(document_ids_value)
    and deleted_at is null;

  return service_case_id;
end;
$$;

revoke all on function public.create_service_case_from_documents(
  uuid, text, public.project_category, text, bigint, public.project_stage,
  uuid, uuid[], jsonb, jsonb
) from public, anon;
grant execute on function public.create_service_case_from_documents(
  uuid, text, public.project_category, text, bigint, public.project_stage,
  uuid, uuid[], jsonb, jsonb
) to authenticated, service_role;

drop policy if exists vendor_files_select on storage.objects;
drop policy if exists vendor_files_insert on storage.objects;
drop policy if exists vendor_files_update on storage.objects;
drop policy if exists vendor_files_delete on storage.objects;

create policy vendor_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'vendor-files'
  and private.storage_owner_type(name) in ('business_project', 'vendor', 'project', 'quote', 'contract', 'meeting')
  and private.can_access_owner(private.storage_owner_type(name), private.storage_owner_id(name), false)
);
create policy vendor_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendor-files'
  and private.storage_owner_type(name) in ('business_project', 'vendor', 'project', 'quote', 'contract', 'meeting')
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

comment on table public.document_analyses is '원본 문서에서 추출한 요약·필수값·근거 및 사용자 검토·반영 이력';
comment on column public.document_analyses.extracted_data is '문서 종류별 구조화 데이터. 실제 업무 테이블 반영 전 반드시 검토한다.';
comment on column public.document_analyses.evidence is '필드별 원문 페이지·근거 문장·신뢰도';
