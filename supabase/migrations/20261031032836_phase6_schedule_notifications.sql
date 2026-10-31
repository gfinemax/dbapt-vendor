-- Phase 6: notification delivery log and secure Cron token verification.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  recipient_user_id uuid not null references public.users(id) on delete restrict,
  stage text not null,
  sent_at timestamptz not null default now(),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  constraint notification_logs_stage_check check (stage in ('D-7', 'D-3', 'D-day', '지연'))
);

create unique index notification_logs_active_delivery_uidx
on public.notification_logs (event_id, recipient_user_id, stage)
where deleted_at is null;
create index notification_logs_recipient_sent_idx
on public.notification_logs (recipient_user_id, sent_at desc)
where deleted_at is null;
create index notification_logs_created_by_idx
on public.notification_logs (created_by)
where deleted_at is null and created_by is not null;

create trigger notification_logs_set_updated_at
before update on public.notification_logs
for each row execute function private.set_updated_at();
create trigger notification_logs_audit
after insert or update or delete on public.notification_logs
for each row execute function private.write_audit_log();

alter table public.notification_logs enable row level security;
revoke all on public.notification_logs from public, anon, authenticated;
grant select on public.notification_logs to authenticated;
grant all on public.notification_logs to service_role;

create policy notification_logs_admin_select on public.notification_logs
for select to authenticated
using ((select public.current_role()) = 'admin');

create or replace function public.verify_daily_reminder_token(input_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    input_token is not null
    and input_token = (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'daily_reminder_token'
      order by created_at desc
      limit 1
    ),
    false
  )
$$;

revoke all on function public.verify_daily_reminder_token(text) from public, anon, authenticated;
grant execute on function public.verify_daily_reminder_token(text) to service_role;
