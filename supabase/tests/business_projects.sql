begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);

select is(
  (select count(*) from public.projects where business_project_id is null),
  0::bigint,
  'every service case belongs to a business project'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is((select count(*) from public.business_projects), 1::bigint, 'viewer sees the active business project');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is((select count(*) from public.business_projects), 1::bigint, 'agent sees the project containing assigned service cases');
select throws_ok(
  $$insert into public.business_projects (title, status) values ('권한 없는 프로젝트', '계획')$$,
  '42501',
  null,
  'agent cannot create a business project'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(
  (select title from public.business_projects where id = '21000000-0000-0000-0000-000000000001'),
  '사무실 홍보관 개설',
  'the requested business project is seeded'
);
select is(
  (select count(*) from public.projects where business_project_id = '21000000-0000-0000-0000-000000000001'),
  10::bigint,
  'the ten existing service cases are linked to the requested project'
);
select lives_ok(
  $$insert into public.business_projects (id, title, status, created_by) values ('21000000-0000-0000-0000-000000000099', '테스트 프로젝트', '계획', '00000000-0000-0000-0000-000000000001')$$,
  'admin can create a business project'
);
select lives_ok(
  $$insert into public.projects (id, business_project_id, title, category, budget, stage, created_by) values ('20000000-0000-0000-0000-000000000099', '21000000-0000-0000-0000-000000000099', '테스트 용역', '기타', 0, '견적요청', '00000000-0000-0000-0000-000000000001')$$,
  'admin can add a service case to a business project'
);
select ok(
  (select count(*) > 0 from public.audit_logs where table_name = 'business_projects'),
  'business project changes are recorded in audit logs'
);

select * from finish();
rollback;
