-- Public sign-up is closed: new logins are created only by the admin-clinics function
-- (which marks them with app_metadata.rxdesk_clinic) or for e-mails listed in admin_emails.
create or replace function private.only_invited_users()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) then
    return new;
  end if;
  if coalesce(new.raw_app_meta_data ->> 'rxdesk_clinic', '') = 'true' then
    return new;
  end if;
  raise exception 'Sign-ups are closed. Ask the RxDesk administrator for an account.';
end;
$$;
revoke execute on function private.only_invited_users() from public, anon, authenticated;
create trigger only_invited_users before insert on auth.users
  for each row execute function private.only_invited_users();
