begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

-- Agent: only assigned projects are visible through the safe view.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

select is((select public.current_role())::text, 'agent', 'agent role resolves from public.users');
select is((select count(*) from public.projects_public), 2::bigint, 'agent sees only two assigned projects');
select is(
  (select count(*) from public.projects_public where id = '20000000-0000-0000-0000-000000000005'),
  0::bigint,
  'agent cannot see an unassigned project'
);
select is((select count(*) from public.projects), 2::bigint, 'agent can read assigned non-sensitive project rows directly');
select is((select count(*) from public.vendors_public), 4::bigint, 'agent sees vendors linked to assigned projects');
select is((select count(*) from public.vendors), 4::bigint, 'agent can read linked non-sensitive vendor rows directly');
select is((select count(*) from public.vendor_internal_notes), 0::bigint, 'agent cannot read vendor internal notes');
select is((select count(*) from public.vendor_financial_details), 0::bigint, 'agent cannot read vendor financial details');

-- Viewer: all active rows through safe views, no sensitive base-table access.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select is((select public.current_role())::text, 'viewer', 'viewer role resolves from public.users');
select is((select count(*) from public.projects_public), 10::bigint, 'viewer sees all active projects');
select is((select count(*) from public.projects), 10::bigint, 'viewer can read active non-sensitive project rows');
select is((select count(*) from public.project_internal_notes), 0::bigint, 'viewer cannot read project internal notes');
select is(
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'projects_public' and column_name = 'internal_note'),
  0::bigint,
  'projects_public does not expose internal_note'
);

-- Admin: base tables, automation, and bucket configuration.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is((select public.current_role())::text, 'admin', 'admin role resolves from public.users');
select is((select count(*) from public.projects), 10::bigint, 'admin can read project base rows');
select is(
  (select count(*) from public.events where source_type in ('contract_start', 'contract_end')),
  4::bigint,
  'two contracts generated four distinct contract events'
);
update public.contracts
set deleted_at = now()
where id = '30000000-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.events where source_id = '30000000-0000-0000-0000-000000000001' and deleted_at is null),
  0::bigint,
  'soft-deleting a contract removes its active generated events'
);
select is(
  (select count(*) from public.events where source_id = '30000000-0000-0000-0000-000000000001' and deleted_at is not null),
  2::bigint,
  'soft-deleted contract events remain available for audit history'
);
select ok((select count(*) > 0 from public.audit_logs), 'seed mutations generated audit logs');

reset role;
select ok(
  (select not public and file_size_limit = 20971520 from storage.buckets where id = 'vendor-files'),
  'vendor-files is private with a 20 MiB limit'
);

select * from finish();
rollback;
