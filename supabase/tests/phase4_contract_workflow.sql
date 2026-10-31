begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(23);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.payment_schedules where contract_id = '30000000-0000-0000-0000-000000000001' and deleted_at is null), 3::bigint, 'seed has three payment rounds');
select is((select sum(amount) from public.payment_schedules where contract_id = '30000000-0000-0000-0000-000000000001' and deleted_at is null), 110000000::numeric, 'seed payment total matches contract total');
select is((select count(*) from public.guarantees where contract_id = '30000000-0000-0000-0000-000000000001' and type = '하자'), 1::bigint, 'seed has a defect guarantee');
select is((select count(*) from public.events where deleted_at is null and source_id in ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001')), 6::bigint, 'approved seed contract generated events');

create temporary table phase4_result as
select public.create_contract_with_payments(
  '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
  '설계 용역계약', '2026-10-31', '2026-11-01', '2027-10-31',
  20000000, 2000000, '조합직접', '계약서함', true, null, null,
  '[{"label":"계약금","due_date":"2026-11-01","amount":11000000},{"label":"잔금","due_date":"2027-10-31","amount":11000000}]'::jsonb
) as id;
select ok((select id is not null from phase4_result), 'contract RPC returns an id');
select is((select approval_status::text from public.contracts where id = (select id from phase4_result)), 'requested', 'new contract waits for approval');
select is((select count(*) from public.payment_schedules where contract_id = (select id from phase4_result)), 2::bigint, 'RPC created two payment rounds');
select is((select count(*) from public.events where source_id = (select id from phase4_result) and deleted_at is null), 0::bigint, 'pending contract has no active contract events');
select is((select count(*) from public.approval_requests where target_type = 'contract' and target_id = (select id from phase4_result) and status = 'requested'), 1::bigint, 'contract approval request exists');
select lives_ok($$select public.decide_approval((select id from public.approval_requests where target_type = 'contract' and target_id = (select id from phase4_result)), 'approved', null)$$, 'admin can approve the contract');
select is((select approval_status::text from public.contracts where id = (select id from phase4_result)), 'approved', 'contract becomes approved');
select is((select count(*) from public.events where source_id = (select id from phase4_result) and deleted_at is null), 2::bigint, 'approval activates start and end events');
select is((select stage::text from public.projects where id = '20000000-0000-0000-0000-000000000003'), '계약', 'approval advances project stage');

select public.create_contract_with_payments(
  '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
  '설계 감액 변경계약', '2026-11-15', '2026-11-15', '2027-10-31',
  19000000, 1900000, '조합직접', '계약서함', true,
  (select id from phase4_result), '범위 조정', '[]'::jsonb
);
select is((select final_amount from public.contract_amendments where contract_id = (select id from phase4_result)), 19000000::bigint, 'amendment stores the final supply amount');
select is((select previous_amount from public.contract_amendments where contract_id = (select id from phase4_result)), 20000000::bigint, 'amendment keeps the previous amount snapshot');
select is((select approval_status::text from public.contract_amendments where contract_id = (select id from phase4_result)), 'requested', 'amendment waits for approval');
select lives_ok($$select public.decide_approval((select id from public.approval_requests where target_type = 'contract_amendment' and project_id = '20000000-0000-0000-0000-000000000003'), 'approved', null)$$, 'admin can approve the amendment');
select is((select amount from public.contracts where id = (select id from phase4_result)), 19000000::bigint, 'approved amendment updates current contract amount');
select is((select count(*) from public.erp_sync_outbox where aggregate_id in ((select id from phase4_result), (select id from public.contract_amendments where contract_id = (select id from phase4_result)))), 2::bigint, 'approvals enter the ERP outbox');

update public.payment_schedules set paid_at = '2026-11-01', settlement_status = '정산요청'
where contract_id = (select id from phase4_result) and seq = 1;
select is((select status::text from public.events where source_type = 'payment_schedule' and source_id = (select id from public.payment_schedules where contract_id = (select id from phase4_result) and seq = 1)), '완료', 'paid payment marks its event complete');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
create temporary table agent_draft as
select public.create_contract_with_payments(
  '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004',
  '인테리어 계약 초안', '2026-11-01', '2026-11-01', '2027-01-31',
  1000000, 100000, '업무대행사대행', '', false, null, null, '[]'::jsonb
) as id;
select is((select approval_status::text from public.contracts where id = (select id from agent_draft)), 'draft', 'assigned agent creates a draft');
select is((select count(*) from public.approval_requests where target_id = (select id from agent_draft)), 0::bigint, 'agent draft does not bypass staff approval request');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok($$select public.create_contract_with_payments('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','권한 없음','2026-10-31','2026-11-01','2027-10-31',1,0,'조합직접','',false,null,null,'[]'::jsonb)$$, '42501', '계약 승인안을 등록할 권한이 없습니다.', 'viewer cannot create a contract');

select * from finish();
rollback;
