-- Phase 4: atomic contract and payment schedule creation.

alter table public.contracts drop constraint contracts_amount_nonnegative;
alter table public.contracts drop constraint contracts_vat_nonnegative;
alter table public.contracts
  add constraint contracts_amount_valid
  check (parent_contract_id is not null or amount >= 0);
alter table public.contracts
  add constraint contracts_vat_valid
  check (parent_contract_id is not null or vat >= 0);

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
  payment_row jsonb;
  payment_seq integer := 0;
  parent_row public.contracts%rowtype;
begin
  if actor_id is null
    or actor_role not in ('admin', 'staff', 'agent')
    or not private.can_write_project(project_id_value) then
    raise exception '계약을 등록할 권한이 없습니다.' using errcode = '42501';
  end if;

  if nullif(trim(title_value), '') is null then
    raise exception '계약명을 입력해 주세요.' using errcode = '22023';
  end if;
  if start_at_value > end_at_value then
    raise exception '종료일은 시작일보다 빠를 수 없습니다.' using errcode = '22023';
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
    if amount_value < 0 or vat_value < 0 then
      raise exception '원계약 금액은 0원 이상이어야 합니다.' using errcode = '22023';
    end if;
  else
    select * into parent_row
    from public.contracts
    where id = parent_contract_id_value and deleted_at is null;
    if not found
      or parent_row.parent_contract_id is not null
      or parent_row.project_id <> project_id_value
      or parent_row.vendor_id <> vendor_id_value then
      raise exception '원계약 연결 정보를 확인해 주세요.' using errcode = '22023';
    end if;
    if amount_value = 0 and vat_value = 0 then
      raise exception '변경계약 증감액을 입력해 주세요.' using errcode = '22023';
    end if;
    if nullif(trim(change_reason_value), '') is null then
      raise exception '변경 사유를 입력해 주세요.' using errcode = '22023';
    end if;
  end if;

  insert into public.contracts (
    project_id, vendor_id, title, signed_at, start_at, end_at,
    amount, vat, contract_party, parent_contract_id, change_reason,
    original_location, is_sealed, created_by
  ) values (
    project_id_value, vendor_id_value, trim(title_value), signed_at_value,
    start_at_value, end_at_value, amount_value, vat_value,
    contract_party_value, parent_contract_id_value,
    nullif(trim(change_reason_value), ''), nullif(trim(original_location_value), ''),
    is_sealed_value, actor_id
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

  if actor_role in ('admin', 'staff') and parent_contract_id_value is null then
    update public.projects set stage = '계약' where id = project_id_value;
    update public.vendors set status = '계약중' where id = vendor_id_value;
  end if;

  return contract_id_value;
end;
$$;

revoke all on function public.create_contract_with_payments(
  uuid, uuid, text, date, date, date, bigint, bigint, text, text,
  boolean, uuid, text, jsonb
) from public, anon;
grant execute on function public.create_contract_with_payments(
  uuid, uuid, text, date, date, date, bigint, bigint, text, text,
  boolean, uuid, text, jsonb
) to authenticated, service_role;
