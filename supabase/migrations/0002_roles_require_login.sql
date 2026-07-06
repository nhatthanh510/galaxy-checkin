-- Galaxy Check-In — require login for the kiosk + role model (staff | admin).
-- Everyone must be authenticated. Staff can use the kiosk; admins can also use
-- the admin area. Replaces the is_admin boolean with a role enum. Kiosk RPCs and
-- catalog reads move from the anon role to authenticated.

-- ---------------------------------------------------------------------------
-- profile.role
-- ---------------------------------------------------------------------------
create type user_role as enum ('staff', 'admin');

alter table public.profile add column if not exists role user_role;

-- Migrate existing is_admin -> role, then drop the old column.
update public.profile set role = case when is_admin then 'admin'::user_role else 'staff'::user_role end
  where role is null;
alter table public.profile alter column role set default 'staff';
alter table public.profile alter column role set not null;
alter table public.profile drop column if exists is_admin;

-- New-user trigger provisions a profile with the default 'staff' role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (id, email, role) values (new.id, new.email, 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Role helpers. is_admin() keeps working (now derived from role); is_staff() is
-- true for any logged-in profile (staff or admin).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role = 'admin' from public.profile p where p.id = auth.uid()), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profile p where p.id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Catalog reads: kiosk is now logged-in, so move "anon reads active ..." to
-- authenticated (any staff/admin).
-- ---------------------------------------------------------------------------
drop policy if exists "anon reads active services" on public.service;
create policy "staff reads active services" on public.service
  for select to authenticated using (active = true);

drop policy if exists "anon reads active service groups" on public.service_group;
create policy "staff reads active service groups" on public.service_group
  for select to authenticated using (active = true);

drop policy if exists "anon reads active technicians" on public.technician;
create policy "staff reads active technicians" on public.technician
  for select to authenticated using (active = true);

drop policy if exists "anon reads active loyalty program" on public.loyalty_program;
create policy "staff reads active loyalty program" on public.loyalty_program
  for select to authenticated using (active = true);

-- app_settings read policy already covers authenticated; drop the anon grant.
drop policy if exists "anyone reads settings" on public.app_settings;
create policy "authed reads settings" on public.app_settings
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Kiosk RPCs: revoke anon, grant authenticated only.
-- ---------------------------------------------------------------------------
revoke execute on function public.lookup_customer_by_phone(text) from anon;
revoke execute on function public.create_checkin(text, text, uuid[], uuid, date, boolean) from anon;
revoke execute on function public.redeem_points(uuid, uuid) from anon;
revoke execute on function public.claim_birthday(uuid) from anon;
revoke execute on function public.queue_notification(uuid, uuid, notification_channel, text, text, jsonb) from anon;

grant execute on function public.lookup_customer_by_phone(text) to authenticated;
grant execute on function public.create_checkin(text, text, uuid[], uuid, date, boolean) to authenticated;
grant execute on function public.redeem_points(uuid, uuid) to authenticated;
grant execute on function public.claim_birthday(uuid) to authenticated;
grant execute on function public.queue_notification(uuid, uuid, notification_channel, text, text, jsonb) to authenticated;
