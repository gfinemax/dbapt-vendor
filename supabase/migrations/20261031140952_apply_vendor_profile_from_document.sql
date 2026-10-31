create function public.apply_vendor_profile_from_document(document_id_value uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.user_role := (select public.current_role());
  vendor_id_value uuid;
  vendor_data jsonb;
  name_value text;
  business_number_value text;
  representative_value text;
  address_value text;
begin
  if actor_id is null or actor_role not in ('admin', 'staff') then
    raise exception '업체 기본정보를 반영할 권한이 없습니다.' using errcode = '42501';
  end if;

  select document.owner_id, analysis.extracted_data->'vendor'
  into vendor_id_value, vendor_data
  from public.documents document
  join public.document_analyses analysis on analysis.document_id = document.id
  where document.id = document_id_value
    and document.owner_type = 'vendor'
    and document.deleted_at is null
    and analysis.deleted_at is null
    and analysis.status = 'review_required'
  for update of analysis;

  if vendor_id_value is null or vendor_data is null or jsonb_typeof(vendor_data) <> 'object' then
    raise exception '반영할 수 있는 업체 분석 결과를 찾지 못했습니다.' using errcode = '22023';
  end if;

  name_value := nullif(trim(vendor_data->>'name'), '');
  business_number_value := nullif(trim(vendor_data->>'business_number'), '');
  representative_value := nullif(trim(vendor_data->>'representative'), '');
  address_value := nullif(trim(vendor_data->>'address'), '');

  if name_value is null
    and business_number_value is null
    and representative_value is null
    and address_value is null then
    raise exception '문서에서 추출된 업체 기본정보가 없습니다.' using errcode = '22023';
  end if;
  if name_value is not null and char_length(name_value) > 100 then
    raise exception '추출된 상호가 너무 깁니다.' using errcode = '22023';
  end if;
  if business_number_value is not null
    and business_number_value !~ '^[0-9]{3}-[0-9]{2}-[0-9]{5}$' then
    raise exception '추출된 사업자번호 형식을 확인해 주세요.' using errcode = '22023';
  end if;
  if representative_value is not null and char_length(representative_value) > 50 then
    raise exception '추출된 대표자명이 너무 깁니다.' using errcode = '22023';
  end if;
  if address_value is not null and char_length(address_value) > 300 then
    raise exception '추출된 주소가 너무 깁니다.' using errcode = '22023';
  end if;

  update public.vendors
  set name = coalesce(name_value, name),
      biz_no = coalesce(business_number_value, biz_no),
      ceo = coalesce(representative_value, ceo),
      address = coalesce(address_value, address)
  where id = vendor_id_value
    and deleted_at is null;
  if not found then
    raise exception '업체를 찾을 수 없거나 수정 권한이 없습니다.' using errcode = '42501';
  end if;

  update public.document_analyses
  set status = 'applied',
      applied_owner_type = 'vendor',
      applied_owner_id = vendor_id_value,
      applied_at = now(),
      applied_by = actor_id,
      reviewed_at = now(),
      reviewed_by = actor_id
  where document_id = document_id_value
    and deleted_at is null;

  return vendor_id_value;
end;
$$;

revoke all on function public.apply_vendor_profile_from_document(uuid) from public, anon;
grant execute on function public.apply_vendor_profile_from_document(uuid) to authenticated, service_role;

comment on function public.apply_vendor_profile_from_document(uuid) is
  '검토한 업체 소유 문서의 AI 추출값을 업체 기본정보에 반영하고 적용 이력을 기록한다.';
