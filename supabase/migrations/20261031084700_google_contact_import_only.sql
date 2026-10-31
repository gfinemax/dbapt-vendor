-- Google 연락처는 resourceName으로만 식별하며 이름이나 전화번호로 자동 병합하지 않는다.
create unique index google_contact_syncs_active_resource_uidx
on public.google_contact_syncs (google_resource_name)
where deleted_at is null and google_resource_name is not null;
