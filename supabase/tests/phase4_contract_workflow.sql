begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(15);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.payment_schedules where contract_id = '30000000-0000-0000-0000-000000000001' and deleted_at is null), 3::bigint, 'new hayden seed has three payment rounds');
select is((select sum(amount) from public.payment_schedules where contract_id = '30000000-0000-0000-0000-000000000001' and deleted_at is null), 110000000::numeric, 'seed payment total matches contract total');
select is((select count(*) from public.guarantees where contract_id = '30000000-0000-0000-0000-000000000001' and type = '하자'), 1::bigint, 'new hayden seed has a defect guarantee');
select is((select count(*) from public.events where deleted_at is null and source_id in ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001')), 6::bigint, 'seed contract generated six schedule events');

create temporary table phase4_result as
select public.create_contract_with_payments(
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003',
  '설계 용역계약', '2026-10-31', '2026-11-01', '2027-10-31',
  20000000, 2000000, '조합직접', '계약서함', true, null, null,
  '[{"label":"계약금","due_date":"2026-11-01","amount":11000000},{"label":"잔금","due_date":"2027-10-31","amount":11000000}]'::jsonb
) as id;

select ok((select id is not null from phase4_result), 'atomic contract RPC returns an id');
select is((select count(*) from public.payment_schedules where contract_id = (select id from phase4_result)), 2::bigint, 'RPC created two payment rounds');
select is((select count(*) from public.events where source_id = (select id from phase4_result) and deleted_at is null), 2::bigint, 'contract generated start and end events');
select is((select stage::text from public.projects where id = '20000000-0000-0000-0000-000000000003'), '계약', 'base contract advances project stage');
select is((select status::text from public.vendors where id = '10000000-0000-0000-0000-000000000003'), '계약중', 'base contract advances vendor status');

create temporary table phase4_change as
select public.create_contract_with_payments(
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003',
  '설계 감액 변경계약', '2026-11-15', '2026-11-15', '2027-10-31',
  -1000000, -100000, '조합직접', '계약서함', true,
  (select id from phase4_result), '범위 조정', '[]'::jsonb
) as id;

select is((select amount from public.contracts where id = (select id from phase4_change)), (-1000000)::bigint, 'change contract keeps a negative delta');
select is((select parent_contract_id from public.contracts where id = (select id from phase4_change)), (select id from phase4_result), 'change contract links to the original');
select is((select change_reason from public.contracts where id = (select id from phase4_change)), '범위 조정', 'change contract keeps its reason');

update public.payment_schedules set paid_at = '2026-11-01', settlement_status = '정산요청'
where contract_id = (select id from phase4_result) and seq = 1;
select is((select status::text from public.events where source_type = 'payment_schedule' and source_id = (select id from public.payment_schedules where contract_id = (select id from phase4_result) and seq = 1)), '완료', 'paid payment marks its event complete');
select is((select settlement_status::text from public.payment_schedules where contract_id = (select id from phase4_result) and seq = 1), '정산요청', 'payment settlement status is saved');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_contract_with_payments('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','권한 없음','2026-10-31','2026-11-01','2027-10-31',1,0,'조합직접','',false,null,null,'[]'::jsonb)$$,
  '42501', '계약을 등록할 권한이 없습니다.', 'viewer cannot create a contract'
);

select * from finish();
rollback;
