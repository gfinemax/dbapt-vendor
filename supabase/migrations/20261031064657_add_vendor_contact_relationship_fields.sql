alter table public.vendors
  add column phone text,
  add column related_person text,
  add column related_person_phone text;

drop view if exists public.vendors_public;
create view public.vendors_public
with (security_invoker = true, security_barrier = true)
as
select
  v.id, v.name, v.biz_no, v.ceo, v.phone, v.address, v.category, v.homepage,
  v.related_person, v.related_person_phone,
  v.status, v.memo, v.created_at, v.updated_at, v.created_by, v.deleted_at
from public.vendors v
where v.deleted_at is null;

revoke all on public.vendors_public from public, anon;
grant select on public.vendors_public to authenticated, service_role;

revoke all on function public.save_vendor_with_sensitive(
  uuid, text, text, text, text, text, text, public.vendor_status,
  text, text, text, text
) from public, anon, authenticated, service_role;

drop function public.save_vendor_with_sensitive(
  uuid, text, text, text, text, text, text, public.vendor_status,
  text, text, text, text
);

create function public.save_vendor_with_sensitive(
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
  internal_note_value text default null,
  phone_value text default null,
  related_person_value text default null,
  related_person_phone_value text default null
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
      name, biz_no, ceo, phone, address, category, homepage,
      related_person, related_person_phone, status, memo, created_by
    ) values (
      trim(name_value), nullif(trim(biz_no_value), ''), nullif(trim(ceo_value), ''),
      nullif(trim(phone_value), ''), nullif(trim(address_value), ''), trim(category_value),
      nullif(trim(homepage_value), ''), nullif(trim(related_person_value), ''),
      nullif(trim(related_person_phone_value), ''), status_value,
      nullif(trim(memo_value), ''), actor_id
    ) returning id into saved_vendor_id;
  else
    update public.vendors
    set name = trim(name_value),
        biz_no = nullif(trim(biz_no_value), ''),
        ceo = nullif(trim(ceo_value), ''),
        phone = nullif(trim(phone_value), ''),
        address = nullif(trim(address_value), ''),
        category = trim(category_value),
        homepage = nullif(trim(homepage_value), ''),
        related_person = nullif(trim(related_person_value), ''),
        related_person_phone = nullif(trim(related_person_phone_value), ''),
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

revoke all on function public.save_vendor_with_sensitive(
  uuid, text, text, text, text, text, text, public.vendor_status,
  text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.save_vendor_with_sensitive(
  uuid, text, text, text, text, text, text, public.vendor_status,
  text, text, text, text, text, text, text
) to authenticated, service_role;
