-- The auth service does not pass app_metadata on the first insert, so the admin-clinics function
-- instead records the e-mail here (service role) right before creating the login.
create table public.invited_emails (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.invited_emails enable row level security;
revoke all on public.invited_emails from anon, authenticated;

create or replace function private.only_invited_users()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) then
    return new;
  end if;
  if exists (select 1 from public.invited_emails where lower(email) = lower(new.email) and created_at > now() - interval '10 minutes') then
    delete from public.invited_emails where lower(email) = lower(new.email);
    return new;
  end if;
  raise exception 'Sign-ups are closed. Ask the RxDesk administrator for an account.';
end;
$$;
