-- RxDesk online: clinics, admins and the synced records table.
-- Every clinic's desktop app pushes and pulls rows of public.sync_rows.
-- Row level security: a clinic owner sees only their clinic; a platform admin sees all clinics.

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  owner_user_id uuid unique references auth.users(id) on delete set null,
  owner_email text not null default '',
  disabled boolean not null default false,
  app_version text not null default '',
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- E-mail addresses that become platform admins when they sign up.
create table public.admin_emails (
  email text primary key
);
insert into public.admin_emails(email) values ('loaymis41@gmail.com');

-- Global change counter used as the pull cursor.
create sequence public.sync_seq;

create table public.sync_rows (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  tbl text not null check (tbl in ('patients','prescriptions','drugs','dose_phrases','favorites','conditions','layouts','settings')),
  uid text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  seq bigint not null default 0,
  primary key (clinic_id, tbl, uid)
);
create index sync_rows_clinic_seq on public.sync_rows (clinic_id, seq);

-- ------------------------------------------------------------------ helpers
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- The clinic of the signed-in doctor (null if none or disabled).
create or replace function public.my_clinic_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.clinics where owner_user_id = (select auth.uid()) and not disabled limit 1;
$$;

-- Sets seq on every write. The per-clinic advisory lock serialises writers of one clinic so
-- rows become visible in seq order and a pull cursor never skips a row.
-- An older edit never replaces a newer one (newest updated_at wins).
create or replace function public.sync_rows_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.clinic_id::text, 0));
  new.seq := nextval('public.sync_seq');
  return new;
end;
$$;
create trigger sync_rows_seq before insert or update on public.sync_rows
  for each row execute function public.sync_rows_before_write();

-- New auth users whose e-mail is listed in admin_emails become admins.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) then
    insert into public.platform_admins(user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.platform_admins(user_id)
  select u.id from auth.users u join public.admin_emails a on lower(a.email) = lower(u.email)
  on conflict do nothing;

-- Called by the desktop app after each sync.
create or replace function public.touch_clinic(p_app_version text)
returns void
language sql security definer set search_path = ''
as $$
  update public.clinics set last_sync_at = now(), app_version = coalesce(p_app_version, '')
  where owner_user_id = (select auth.uid()) and not disabled;
$$;

-- Counts for the admin clinics list.
create or replace function public.clinic_stats()
returns table (clinic_id uuid, patients bigint, prescriptions bigint, drugs bigint)
language sql stable security definer set search_path = ''
as $$
  select r.clinic_id,
    count(*) filter (where r.tbl = 'patients'),
    count(*) filter (where r.tbl = 'prescriptions'),
    count(*) filter (where r.tbl = 'drugs')
  from public.sync_rows r
  where not r.deleted and public.is_admin()
  group by r.clinic_id;
$$;

revoke execute on function public.touch_clinic(text) from anon, public;
revoke execute on function public.clinic_stats() from anon, public;
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.my_clinic_id() from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.sync_rows_before_write() from anon, authenticated, public;
grant execute on function public.touch_clinic(text) to authenticated;
grant execute on function public.clinic_stats() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_clinic_id() to authenticated;

-- ------------------------------------------------------------------ row level security
alter table public.clinics enable row level security;
alter table public.platform_admins enable row level security;
alter table public.admin_emails enable row level security;
alter table public.sync_rows enable row level security;

create policy clinics_select on public.clinics for select to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_admin()));
create policy clinics_admin_insert on public.clinics for insert to authenticated
  with check ((select public.is_admin()));
create policy clinics_admin_update on public.clinics for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy clinics_admin_delete on public.clinics for delete to authenticated
  using ((select public.is_admin()));

create policy admins_select_self on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- admin_emails: no policies, so only the service role can read it.

create policy sync_rows_select on public.sync_rows for select to authenticated
  using (clinic_id = (select public.my_clinic_id()) or (select public.is_admin()));
create policy sync_rows_insert on public.sync_rows for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) or (select public.is_admin()));
create policy sync_rows_update on public.sync_rows for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) or (select public.is_admin()))
  with check (clinic_id = (select public.my_clinic_id()) or (select public.is_admin()));
create policy sync_rows_delete on public.sync_rows for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.admin_emails from anon, authenticated;
revoke all on public.clinics, public.platform_admins, public.sync_rows from anon;
grant select, insert, update, delete on public.clinics, public.sync_rows to authenticated;
grant select on public.platform_admins to authenticated;
