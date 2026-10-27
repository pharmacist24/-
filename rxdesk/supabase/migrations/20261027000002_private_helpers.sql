-- Keep the policy helpers out of the public API: they are only used inside RLS policies.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_admin() set schema private;
alter function public.my_clinic_id() set schema private;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.my_clinic_id() to authenticated;

-- clinic_stats calls is_admin: point it at the new schema.
create or replace function public.clinic_stats()
returns table (clinic_id uuid, patients bigint, prescriptions bigint, drugs bigint)
language sql stable security definer set search_path = ''
as $$
  select r.clinic_id,
    count(*) filter (where r.tbl = 'patients'),
    count(*) filter (where r.tbl = 'prescriptions'),
    count(*) filter (where r.tbl = 'drugs')
  from public.sync_rows r
  where not r.deleted and private.is_admin()
  group by r.clinic_id;
$$;
