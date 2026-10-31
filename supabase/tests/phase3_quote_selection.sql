begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(14);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.quotes where project_id = '20000000-0000-0000-0000-000000000004'), 4::bigint, 'interior seed has four quotes');
select lives_ok($$insert into public.quotes (project_id, vendor_id, version, received_at, amount, created_by) values ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 3, '2026-11-01', 147000000, '00000000-0000-0000-0000-000000000001')$$, 'admin can add the next quote version');
select is((select max(version) from public.quotes where project_id = '20000000-0000-0000-0000-000000000004' and vendor_id = '10000000-0000-0000-0000-000000000004'), 3, 'quote versions increase');
select throws_ok($$insert into public.quotes (project_id, vendor_id, version, received_at, amount, created_by) values ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 3, '2026-11-01', 1, '00000000-0000-0000-0000-000000000001')$$, '23505', null, 'active quote version is unique');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select public.current_role())::text, 'staff', 'staff role is active');
create temporary table phase3_request as
select public.request_vendor_selection('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', '가격과 공사기간 종합평가', '제12차 이사회 · 2026.11.05.') as id;
select ok((select id is not null from phase3_request), 'staff can request vendor selection approval');
select is((select status::text from public.approval_requests where id = (select id from phase3_request)), 'requested', 'selection remains pending');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select public.current_role())::text, 'executive', 'executive role is active');
select lives_ok($$select public.decide_approval((select id from phase3_request), 'approved', null)$$, 'executive approves the request');
select is((select selected_vendor_id from public.projects where id = '20000000-0000-0000-0000-000000000004'), '10000000-0000-0000-0000-000000000005'::uuid, 'selected vendor is stored');
select is((select stage::text from public.projects where id = '20000000-0000-0000-0000-000000000004'), '선정', 'project stage changes after approval');
select is((select count(*) from public.project_vendors where project_id = '20000000-0000-0000-0000-000000000004' and role = '탈락'), 2::bigint, 'other candidates are rejected');
select is((select status::text from public.vendors where id = '10000000-0000-0000-0000-000000000005'), '선정', 'vendor status changes after approval');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$select public.request_vendor_selection('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '임의 선정', '임의 의결')$$, '42501', '업체 선정안을 요청할 권한이 없습니다.', 'agent cannot request vendor selection');

select * from finish();
rollback;
