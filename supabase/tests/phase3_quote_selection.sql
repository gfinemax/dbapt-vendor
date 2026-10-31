begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.quotes where project_id = '20000000-0000-0000-0000-000000000004'),
  4::bigint,
  'interior seed has quotes from all three participating vendors'
);

select lives_ok(
  $$insert into public.quotes (project_id, vendor_id, version, received_at, amount, created_by) values ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 3, '2026-11-01', 147000000, '00000000-0000-0000-0000-000000000001')$$,
  'admin can add the next quote version'
);

select is(
  (select max(version) from public.quotes where project_id = '20000000-0000-0000-0000-000000000004' and vendor_id = '10000000-0000-0000-0000-000000000004'),
  3,
  'quote versions can increase for the same vendor'
);

select throws_ok(
  $$insert into public.quotes (project_id, vendor_id, version, received_at, amount, created_by) values ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 3, '2026-11-01', 1, '00000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'active quote version is unique per project and vendor'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select is((select public.current_role())::text, 'executive', 'executive role is active');

select lives_ok(
  $$select public.select_project_vendor('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', '가격과 공사기간 종합평가', '제12차 이사회 · 2026.11.05.')$$,
  'executive can approve a participating vendor'
);

select is(
  (select selected_vendor_id from public.projects where id = '20000000-0000-0000-0000-000000000004'),
  '10000000-0000-0000-0000-000000000005'::uuid,
  'selected vendor is stored on the project'
);

select is(
  (select stage::text from public.projects where id = '20000000-0000-0000-0000-000000000004'),
  '선정',
  'project stage changes to selected'
);

select is(
  (select role from public.project_vendors where project_id = '20000000-0000-0000-0000-000000000004' and vendor_id = '10000000-0000-0000-0000-000000000005'),
  '선정',
  'chosen project vendor is marked selected'
);

select is(
  (select count(*) from public.project_vendors where project_id = '20000000-0000-0000-0000-000000000004' and role = '탈락'),
  2::bigint,
  'other candidates are marked not selected'
);

select is(
  (select status::text from public.vendors where id = '10000000-0000-0000-0000-000000000005'),
  '선정',
  'selected vendor status is updated'
);

select throws_ok(
  $$update public.projects set budget = budget + 1 where id = '20000000-0000-0000-0000-000000000004'$$,
  '42501',
  '조합 임원은 선정 승인 정보만 변경할 수 있습니다.',
  'executive cannot change non-approval project fields'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.select_project_vendor('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '임의 선정', '임의 의결')$$,
  '42501',
  '업체 선정 승인 권한이 없습니다.',
  'agent cannot approve vendor selection'
);

select * from finish();
rollback;
