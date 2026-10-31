begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is((select public.current_role())::text, 'admin', 'admin role is active for vendor workflow');

insert into public.vendors (
  id, name, biz_no, ceo, category, status, created_by
) values (
  '90000000-0000-0000-0000-000000000001',
  'Phase 2 검증업체',
  '999-99-99999',
  '검증 대표',
  '검증',
  '후보',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.vendor_internal_notes (vendor_id, content, created_by)
values (
  '90000000-0000-0000-0000-000000000001',
  'agent와 viewer에게 숨길 검증 메모',
  '00000000-0000-0000-0000-000000000001'
);

select is(
  (select count(*) from public.vendors where id = '90000000-0000-0000-0000-000000000001'),
  1::bigint,
  'admin can register a vendor'
);

update public.vendors
set status = '견적중', memo = '수정 검증'
where id = '90000000-0000-0000-0000-000000000001';

select is(
  (select status::text from public.vendors where id = '90000000-0000-0000-0000-000000000001'),
  '견적중',
  'admin can update a vendor'
);

insert into public.vendor_contacts (
  id, vendor_id, name, title, phone, email, duty, is_primary, active, created_by
) values (
  '90000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000001',
  '검증 담당자',
  '팀장',
  '010-9999-9999',
  'phase2@example.com',
  '검증 업무',
  true,
  true,
  '00000000-0000-0000-0000-000000000001'
);

select ok(
  (select is_primary and active from public.vendor_contacts where id = '90000000-0000-0000-0000-000000000002'),
  'vendor contact can be added as the active primary contact'
);

update public.vendor_contacts
set active = false, is_primary = false
where id = '90000000-0000-0000-0000-000000000002';

select ok(
  (select not active and not is_primary from public.vendor_contacts where id = '90000000-0000-0000-0000-000000000002'),
  'contact deactivation preserves the row'
);

insert into public.contact_logs (
  vendor_id, contact_id, method, at, summary, created_by
) values (
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000002',
  '통화',
  '2026-10-31 09:30:00+09',
  '연락 이력 검증',
  '00000000-0000-0000-0000-000000000001'
);

select is(
  (select count(*) from public.contact_logs where vendor_id = '90000000-0000-0000-0000-000000000001'),
  1::bigint,
  'contact history can be recorded'
);

insert into public.documents (
  owner_type, owner_id, kind, file_path, file_name, version, valid_until, created_by
) values (
  'vendor',
  '90000000-0000-0000-0000-000000000001',
  '사업자등록증',
  'vendor/90000000-0000-0000-0000-000000000001/사업자등록증/phase2_test.pdf',
  'phase2_test.pdf',
  1,
  '2026-11-30',
  '00000000-0000-0000-0000-000000000001'
);

select is(
  (select count(*) from public.documents where owner_id = '90000000-0000-0000-0000-000000000001'),
  1::bigint,
  'vendor document metadata can be registered'
);

select ok(
  (select count(*) >= 4 from public.audit_logs where row_id in (
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000002'
  )),
  'vendor and contact changes are audited'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.vendors_public where id = '90000000-0000-0000-0000-000000000001'),
  0::bigint,
  'agent cannot see an unassigned vendor'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.vendors_public where id = '90000000-0000-0000-0000-000000000001'),
  1::bigint,
  'viewer can see the active vendor through the safe view'
);

select * from finish();
rollback;
