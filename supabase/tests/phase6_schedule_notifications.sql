begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

delete from vault.secrets where name = 'daily_reminder_token';
select lives_ok($$select vault.create_secret('phase6-test-token', 'daily_reminder_token')$$, 'daily reminder token can be stored in Vault');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.events (id, type, title, date, project_id, status, created_by)
values ('90000000-0000-0000-0000-000000000001', '기타', '지연 검증 일정', '2026-01-01', '20000000-0000-0000-0000-000000000001', '예정', '00000000-0000-0000-0000-000000000001');
select is((select count(*) from public.events where id = '90000000-0000-0000-0000-000000000001'), 1::bigint, 'admin can create a manual event');
select throws_ok(
  $$insert into public.notification_logs (event_id, recipient_user_id, stage) values ('90000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','지연')$$,
  '42501', 'permission denied for table notification_logs', 'authenticated users cannot forge notification logs'
);

reset role;
set local role service_role;
select ok((select public.mark_overdue_events() >= 1), 'overdue marker updates past events');
select is((select status::text from public.events where id = '90000000-0000-0000-0000-000000000001'), '지연', 'past event is marked delayed');
select ok(public.verify_daily_reminder_token('phase6-test-token'), 'service role can verify the Cron token');
select is(public.verify_daily_reminder_token('wrong-token'), false, 'wrong Cron token is rejected');
insert into public.notification_logs (event_id, recipient_user_id, stage)
values ('90000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','지연');
select is((select count(*) from public.notification_logs where event_id = '90000000-0000-0000-0000-000000000001'), 1::bigint, 'service role records a notification delivery');
select throws_ok(
  $$insert into public.notification_logs (event_id, recipient_user_id, stage) values ('90000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','지연')$$,
  '23505', null, 'same event recipient and stage is logged only once'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.notification_logs), 1::bigint, 'admin can inspect notification logs');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is((select count(*) from public.notification_logs), 0::bigint, 'viewer cannot inspect notification logs');
select throws_ok(
  $$insert into public.events (type,title,date,project_id) values ('기타','권한 없음','2026-11-01','20000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'viewer cannot create a manual event'
);

select * from finish();
rollback;
