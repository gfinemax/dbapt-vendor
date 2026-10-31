begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

update public.users set role = 'staff', active = false where id = '00000000-0000-0000-0000-000000000005';
select is((select role::text from public.users where id = '00000000-0000-0000-0000-000000000005'), 'staff', 'admin can change a user role');
select is((select active from public.users where id = '00000000-0000-0000-0000-000000000005'), false, 'admin can deactivate a user');

insert into public.project_assignees (project_id, user_id, created_by)
values ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001');
select is((select count(*) from public.project_assignees where project_id = '20000000-0000-0000-0000-000000000005' and user_id = '00000000-0000-0000-0000-000000000005' and deleted_at is null), 1::bigint, 'admin can assign a project user');
update public.project_assignees set deleted_at = now() where project_id = '20000000-0000-0000-0000-000000000005' and user_id = '00000000-0000-0000-0000-000000000005';
select is((select count(*) from public.project_assignees where project_id = '20000000-0000-0000-0000-000000000005' and user_id = '00000000-0000-0000-0000-000000000005' and deleted_at is not null), 1::bigint, 'assignment can be soft deleted');
update public.project_assignees set deleted_at = null where project_id = '20000000-0000-0000-0000-000000000005' and user_id = '00000000-0000-0000-0000-000000000005';
select is((select count(*) from public.project_assignees where project_id = '20000000-0000-0000-0000-000000000005' and user_id = '00000000-0000-0000-0000-000000000005' and deleted_at is null), 1::bigint, 'assignment can be restored');

insert into public.events (id,type,title,date,project_id,created_by) values ('90000000-0000-0000-0000-000000000007','기타','휴지통 검증','2026-11-30','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
update public.events set deleted_at = now() where id = '90000000-0000-0000-0000-000000000007';
select is((select count(*) from public.events where id = '90000000-0000-0000-0000-000000000007' and deleted_at is not null), 1::bigint, 'admin can inspect a soft-deleted event');
update public.events set deleted_at = null where id = '90000000-0000-0000-0000-000000000007';
select is((select count(*) from public.events where id = '90000000-0000-0000-0000-000000000007' and deleted_at is null), 1::bigint, 'soft-deleted event can be restored');
delete from public.events where id = '90000000-0000-0000-0000-000000000007';
select is((select count(*) from public.events where id = '90000000-0000-0000-0000-000000000007'), 0::bigint, 'admin can permanently delete an unreferenced event');
select ok((select count(*) > 0 from public.audit_logs where table_name in ('users','project_assignees','events')), 'admin changes are recorded in audit logs');
create temporary table audit_count_before as select count(*) as count from public.audit_logs;
delete from public.audit_logs;
select is((select count(*) from public.audit_logs), (select count from audit_count_before), 'audit logs are append-only even for admin');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is((select count(*) from public.audit_logs), 0::bigint, 'non-admin cannot inspect audit logs');

select * from finish();
rollback;
