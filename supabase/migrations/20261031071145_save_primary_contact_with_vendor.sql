create function public.save_vendor_with_primary_contact(
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
  related_person_phone_value text default null,
  primary_contact_name_value text default null,
  primary_contact_phone_value text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  saved_vendor_id uuid;
  target_contact_id uuid;
begin
  saved_vendor_id := public.save_vendor_with_sensitive(
    vendor_id_value => vendor_id_value,
    name_value => name_value,
    biz_no_value => biz_no_value,
    ceo_value => ceo_value,
    address_value => address_value,
    category_value => category_value,
    homepage_value => homepage_value,
    status_value => status_value,
    memo_value => memo_value,
    bank_name_value => bank_name_value,
    bank_account_value => bank_account_value,
    internal_note_value => internal_note_value,
    phone_value => phone_value,
    related_person_value => related_person_value,
    related_person_phone_value => related_person_phone_value
  );

  select vc.id
  into target_contact_id
  from public.vendor_contacts vc
  where vc.vendor_id = saved_vendor_id
    and vc.active
    and vc.deleted_at is null
  order by vc.is_primary desc, vc.created_at, vc.id
  limit 1
  for update;

  if nullif(trim(primary_contact_name_value), '') is null
    and nullif(trim(primary_contact_phone_value), '') is not null then
    raise exception '담당자 연락처를 입력하려면 담당자 이름이 필요합니다.' using errcode = '22023';
  end if;

  if nullif(trim(primary_contact_name_value), '') is null then
    if target_contact_id is not null then
      update public.vendor_contacts
      set active = false,
          is_primary = false
      where id = target_contact_id;
    end if;
  else
    update public.vendor_contacts
    set is_primary = false
    where vendor_id = saved_vendor_id
      and id is distinct from target_contact_id
      and is_primary
      and deleted_at is null;

    if target_contact_id is null then
      insert into public.vendor_contacts (
        vendor_id, name, phone, is_primary, active, created_by
      ) values (
        saved_vendor_id, trim(primary_contact_name_value),
        nullif(trim(primary_contact_phone_value), ''), true, true, actor_id
      );
    else
      update public.vendor_contacts
      set name = trim(primary_contact_name_value),
          phone = nullif(trim(primary_contact_phone_value), ''),
          is_primary = true,
          active = true
      where id = target_contact_id;
    end if;
  end if;

  return saved_vendor_id;
end;
$$;

revoke all on function public.save_vendor_with_primary_contact(
  uuid, text, text, text, text, text, text, public.vendor_status,
  text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.save_vendor_with_primary_contact(
  uuid, text, text, text, text, text, text, public.vendor_status,
  text, text, text, text, text, text, text, text, text
) to authenticated, service_role;
