create table public.google_contact_connections (
  id uuid primary key default gen_random_uuid(),
  account_email text not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_tag text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz
);

create unique index google_contact_connections_one_active_uidx
on public.google_contact_connections ((true))
where deleted_at is null;

create index google_contact_connections_created_by_idx
on public.google_contact_connections (created_by);

create table public.google_contact_syncs (
  id uuid primary key default gen_random_uuid(),
  vendor_contact_id uuid not null references public.vendor_contacts(id) on delete restrict,
  google_resource_name text,
  google_etag text,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'failed')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz
);

create unique index google_contact_syncs_active_contact_uidx
on public.google_contact_syncs (vendor_contact_id)
where deleted_at is null;

create index google_contact_syncs_status_idx
on public.google_contact_syncs (sync_status, updated_at desc)
where deleted_at is null;

create index google_contact_syncs_created_by_idx
on public.google_contact_syncs (created_by);

alter table public.google_contact_connections enable row level security;
alter table public.google_contact_syncs enable row level security;

create policy google_contact_connections_select
on public.google_contact_connections for select to authenticated
using ((select public.current_role()) = 'admin');

create policy google_contact_connections_insert
on public.google_contact_connections for insert to authenticated
with check ((select public.current_role()) = 'admin');

create policy google_contact_connections_update
on public.google_contact_connections for update to authenticated
using ((select public.current_role()) = 'admin')
with check ((select public.current_role()) = 'admin');

create policy google_contact_connections_delete
on public.google_contact_connections for delete to authenticated
using ((select public.current_role()) = 'admin');

create policy google_contact_syncs_select
on public.google_contact_syncs for select to authenticated
using ((select public.current_role()) = 'admin');

create policy google_contact_syncs_insert
on public.google_contact_syncs for insert to authenticated
with check ((select public.current_role()) = 'admin');

create policy google_contact_syncs_update
on public.google_contact_syncs for update to authenticated
using ((select public.current_role()) = 'admin')
with check ((select public.current_role()) = 'admin');

create policy google_contact_syncs_delete
on public.google_contact_syncs for delete to authenticated
using ((select public.current_role()) = 'admin');

revoke all on public.google_contact_connections, public.google_contact_syncs from public, anon;
grant select, insert, update, delete on public.google_contact_connections to authenticated, service_role;
grant select, insert, update, delete on public.google_contact_syncs to authenticated, service_role;

create trigger google_contact_connections_set_updated_at
before update on public.google_contact_connections
for each row execute function private.set_updated_at();

create trigger google_contact_syncs_set_updated_at
before update on public.google_contact_syncs
for each row execute function private.set_updated_at();

create or replace function private.write_google_contact_connection_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  redacted_before jsonb;
  redacted_after jsonb;
begin
  target_id := case when tg_op = 'DELETE' then old.id else new.id end;
  redacted_before := case
    when tg_op in ('UPDATE', 'DELETE') then
      to_jsonb(old) - array['refresh_token_ciphertext', 'refresh_token_iv', 'refresh_token_tag']
    else null
  end;
  redacted_after := case
    when tg_op in ('INSERT', 'UPDATE') then
      to_jsonb(new) - array['refresh_token_ciphertext', 'refresh_token_iv', 'refresh_token_tag']
    else null
  end;

  insert into public.audit_logs (
    table_name, row_id, action, before, after, user_id, created_by
  ) values (
    tg_table_name, target_id, tg_op, redacted_before, redacted_after,
    (select auth.uid()), (select auth.uid())
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.write_google_contact_connection_audit()
from public, anon, authenticated;

create trigger google_contact_connections_audit
after insert or update or delete on public.google_contact_connections
for each row execute function private.write_google_contact_connection_audit();

create trigger google_contact_syncs_audit
after insert or update or delete on public.google_contact_syncs
for each row execute function private.write_audit_log();
