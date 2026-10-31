begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(15);

select has_table('public', 'document_analyses', 'document analysis table exists');
select has_column('public', 'documents', 'mime_type', 'documents preserve mime type');
select has_column('public', 'documents', 'file_size', 'documents preserve file size');
select has_column('public', 'document_analyses', 'progress_step', 'analysis progress step is persisted');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.documents (
    id, owner_type, owner_id, kind, file_path, file_name, mime_type, file_size, created_by
  ) values
  ('70000000-0000-0000-0000-000000000001', 'business_project', '21000000-0000-0000-0000-000000000001', '견적서', 'business_project/21000000-0000-0000-0000-000000000001/견적서/quote.pdf', '테스트 견적서.pdf', 'application/pdf', 100, '00000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002', 'business_project', '21000000-0000-0000-0000-000000000001', '계약서', 'business_project/21000000-0000-0000-0000-000000000001/계약서/contract.pdf', '테스트 계약서.pdf', 'application/pdf', 200, '00000000-0000-0000-0000-000000000001')$$,
  'admin can register pre-service-case project documents'
);

select lives_ok(
  $$insert into public.document_analyses (
    document_id, status, detected_kind, summary, extracted_data, evidence, confidence, created_by
  ) values
  ('70000000-0000-0000-0000-000000000001', 'review_required', '견적서', '견적 분석', '{"document_type":"quote"}', '[]', 0.9, '00000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002', 'review_required', '계약서', '계약 분석', '{"document_type":"contract"}', '[]', 0.9, '00000000-0000-0000-0000-000000000001')$$,
  'admin can save reviewable document analyses'
);

select lives_ok(
  $$select public.create_service_case_from_documents(
    '21000000-0000-0000-0000-000000000001',
    '문서 자동등록 테스트',
    '홍보관·사무실',
    '견적서와 계약서에서 생성',
    11000000,
    '계약',
    null,
    array['70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002']::uuid[],
    '[{"document_id":"70000000-0000-0000-0000-000000000001","vendor_id":"10000000-0000-0000-0000-000000000004","received_at":"2026-10-31","amount":11000000,"vat_included":true,"duration_days":30,"warranty_months":12,"payment_terms":"계약금 30%, 잔금 70%","items":[{"name":"설계","amount":11000000}],"note":"자동 추출"}]',
    '[{"document_id":"70000000-0000-0000-0000-000000000002","vendor_id":"10000000-0000-0000-0000-000000000004","title":"테스트 계약","signed_at":"2026-10-31","start_at":"2026-11-01","end_at":"2026-11-30","amount":10000000,"vat":1000000,"contract_party":"조합직접","is_sealed":true,"payments":[]}]'
  )$$,
  'reviewed quote and contract documents create one service case transactionally'
);

select is(
  (select count(*) from public.projects where title = '문서 자동등록 테스트' and deleted_at is null),
  1::bigint,
  'service case is created from document proposals'
);
select is(
  (select count(*) from public.quotes quote join public.projects project on project.id = quote.project_id where project.title = '문서 자동등록 테스트' and quote.amount = 11000000),
  1::bigint,
  'quote version is created from selected quote document'
);
select is(
  (select count(*) from public.contracts contract join public.projects project on project.id = contract.project_id where project.title = '문서 자동등록 테스트' and contract.amount = 10000000 and contract.vat = 1000000),
  1::bigint,
  'contract approval draft is created from selected contract document'
);
select is(
  (select count(*) from public.approval_requests request join public.projects project on project.id = request.project_id where project.title = '문서 자동등록 테스트' and request.target_type = 'contract'),
  1::bigint,
  'document-created contract keeps the existing approval workflow'
);
select is(
  (select count(*) from public.document_analyses where document_id in ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002') and status = 'applied' and applied_project_id is not null),
  2::bigint,
  'both document analyses retain their applied project provenance'
);
select is(
  (select count(*) from public.document_analyses where document_id in ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002') and progress_step = 'applied'),
  2::bigint,
  'applied analyses expose the final progress step'
);
select ok(
  (select count(*) > 0 from public.audit_logs where table_name = 'document_analyses'),
  'analysis and review changes are audited'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
select throws_ok(
  $$insert into public.document_analyses (document_id, status) values ('70000000-0000-0000-0000-000000000001', 'queued')$$,
  '42501',
  null,
  'viewer cannot create or replace an analysis'
);

select * from finish();
rollback;
