insert into public.business_projects (id, title, description, status, created_by)
values (
  '21000000-0000-0000-0000-000000000002',
  '조합 운영·사업추진 기반 구축',
  '조합 운영과 사업 추진에 필수적인 업무대행, 신탁, 설계 등 공통 용역을 통합 관리하는 프로젝트',
  '진행',
  (select id from public.users where role = 'admin' and deleted_at is null order by created_at limit 1)
);

update public.projects
set business_project_id = '21000000-0000-0000-0000-000000000002'
where id in (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003'
)
and business_project_id = '21000000-0000-0000-0000-000000000001'
and deleted_at is null;

comment on table public.business_projects is '여러 용역 건을 묶는 상위 사업·현장 프로젝트. 운영·사업추진 기반과 개별 실행 프로젝트를 구분한다.';
