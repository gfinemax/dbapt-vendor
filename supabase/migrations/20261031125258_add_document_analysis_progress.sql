alter table public.document_analyses
  add column progress_step text not null default 'registered';

alter table public.document_analyses
  add constraint document_analyses_progress_step_check
  check (progress_step in (
    'registered',
    'queued',
    'loading_file',
    'analyzing',
    'saving',
    'review_required',
    'applied'
  ));

update public.document_analyses
set progress_step = case status
  when 'queued' then 'queued'
  when 'analyzing' then 'analyzing'
  when 'review_required' then 'review_required'
  when 'applied' then 'applied'
  when 'failed' then 'queued'
  else 'registered'
end;

create function public.sync_document_analysis_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'applied' then
    new.progress_step := 'applied';
  elsif new.status = 'review_required' then
    new.progress_step := 'review_required';
  elsif new.status = 'queued' and new.progress_step = 'registered' then
    new.progress_step := 'queued';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_document_analysis_progress() from public, anon, authenticated;

create trigger document_analyses_sync_progress
before insert or update of status on public.document_analyses
for each row execute function public.sync_document_analysis_progress();

comment on column public.document_analyses.progress_step is
  '원본 등록부터 검토·반영까지 자동 분석의 현재 실제 처리 단계';
