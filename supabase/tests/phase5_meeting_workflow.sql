begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(10);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.meetings where id = '70000000-0000-0000-0000-000000000001'), 1::bigint, 'seed meeting exists');
select is((select count(*) from public.action_items where meeting_id = '70000000-0000-0000-0000-000000000001'), 2::bigint, 'seed meeting has two follow-up actions');
select is((select count(*) from public.events where source_type = 'action_item' and source_id in ('80000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002') and deleted_at is null), 2::bigint, 'seed follow-up actions generated events');
select ok((select count(*) = 1 from pg_indexes where schemaname = 'public' and indexname = 'meetings_search_idx'), 'meeting full-text search index exists');

create temporary table meeting_result as
select public.create_meeting_with_actions(
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '2026-10-31 16:00:00+09', '화상', '사무국장', '실무담당자',
  '원격 회의 준비', '논의 내용', '결정 내용',
  '[{"content":"자료 배포","assignee_user_id":"00000000-0000-0000-0000-000000000003","due_date":"2026-11-06"},{"content":"참석 확인","assignee_user_id":"","due_date":"2026-11-07"}]'::jsonb
) as id;

select ok((select id is not null from meeting_result), 'atomic meeting RPC returns an id');
select is((select count(*) from public.action_items where meeting_id = (select id from meeting_result)), 2::bigint, 'RPC created two action items');
select is((select count(*) from public.events where source_type = 'action_item' and source_id in (select id from public.action_items where meeting_id = (select id from meeting_result))), 2::bigint, 'RPC action items generated two events');

update public.action_items set status = '완료'
where meeting_id = (select id from meeting_result) and content = '자료 배포';
select is((select status::text from public.events where source_type = 'action_item' and source_id = (select id from public.action_items where meeting_id = (select id from meeting_result) and content = '자료 배포')), '완료', 'completing an action also completes its event');
select is((select count(*) from public.meetings where to_tsvector('simple', coalesce(agenda,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(decisions,'')) @@ plainto_tsquery('simple', '원격 회의')), 1::bigint, 'meeting content is searchable');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_meeting_with_actions('20000000-0000-0000-0000-000000000001',null,now(),'대면','','','권한 없음','','','[]'::jsonb)$$,
  '42501', '협의록을 등록할 권한이 없습니다.', 'viewer cannot create a meeting'
);

select * from finish();
rollback;
