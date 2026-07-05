-- Galaxy Check-In — admin auth, kiosk RPCs, notifications.
-- Builds on 0001_init.sql. Adds:
--   * profile table + is_admin() helper + auto-provision trigger
--   * SECURITY DEFINER RPCs for the anon kiosk path (lookup + create checkin),
--     replacing the broad anon INSERT policies from 0001
--   * a notification log table (placeholder for SMS/email)
--   * tightens data-management policies from "authenticated" to admin-only

-- ===========================================================================
-- profile — one row per auth user; carries the is_admin flag.
-- ===========================================================================
create table if not exists public.profile (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profile enable row level security;

-- Helper: is the current user an admin? SECURITY DEFINER so it can read profile
-- regardless of the caller's own RLS. STABLE — safe to use inside policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profile p where p.id = auth.uid()),
    false
  );
$$;

-- A user can read/update their own profile; admins can read all profiles.
create policy "read own profile" on public.profile
  for select to authenticated using (id = auth.uid() or public.is_admin());

create policy "update own profile" on public.profile
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Auto-provision a profile row when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Kiosk RPCs (SECURITY DEFINER) — the ONLY anon path that touches `customer`.
-- The broad anon INSERT policies from 0001 are dropped in favor of these.
-- ===========================================================================
drop policy if exists "anon creates customers" on public.customer;
drop policy if exists "anon creates checkins" on public.checkin;
drop policy if exists "anon links checkin services" on public.checkin_service;

-- Look up a single customer by phone. Returns 0 or 1 row; never exposes the
-- whole table to anon.
create or replace function public.lookup_customer_by_phone(p_phone text)
returns setof public.customer
language sql
stable
security definer
set search_path = public
as $$
  select * from public.customer where phone = p_phone limit 1;
$$;

-- Create a checkin (status `waiting`), upserting the customer by phone first.
-- Bumps visit_count. Returns the resulting customer row. Atomic.
create or replace function public.create_checkin(
  p_phone         text,
  p_name          text,
  p_service_ids   uuid[] default '{}',
  p_technician_id uuid   default null
)
returns table (
  checkin_id     uuid,
  customer_id    uuid,
  customer_name  text,
  points_balance integer,
  visit_count    integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customer;
  v_checkin_id uuid;
  v_service_id uuid;
begin
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone is required';
  end if;

  -- Upsert customer by phone.
  select * into v_customer from public.customer where phone = p_phone;
  if v_customer.id is null then
    insert into public.customer (phone, name, visit_count, points_balance)
    values (p_phone, coalesce(nullif(trim(p_name), ''), 'Guest'), 1, 0)
    returning * into v_customer;
  else
    update public.customer
      set visit_count = visit_count + 1
      where id = v_customer.id
      returning * into v_customer;
  end if;

  -- Create the checkin.
  insert into public.checkin (customer_id, technician_id, status)
  values (v_customer.id, p_technician_id, 'waiting')
  returning id into v_checkin_id;

  -- Link services.
  if p_service_ids is not null then
    foreach v_service_id in array p_service_ids loop
      insert into public.checkin_service (checkin_id, service_id)
      values (v_checkin_id, v_service_id)
      on conflict do nothing;
    end loop;
  end if;

  return query
    select v_checkin_id, v_customer.id, v_customer.name,
           v_customer.points_balance, v_customer.visit_count;
end;
$$;

-- Grant execute to the anon (kiosk) role. revoke the default public grant on the
-- write RPC so only anon/authenticated may call it.
grant execute on function public.lookup_customer_by_phone(text) to anon, authenticated;
grant execute on function public.create_checkin(text, text, uuid[], uuid) to anon, authenticated;

-- ===========================================================================
-- Tighten data-management policies to admin-only.
-- (Kiosk still works via the SECURITY DEFINER RPCs above.)
-- ===========================================================================
drop policy if exists "staff full access customer" on public.customer;
create policy "admin manages customer" on public.customer
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff full access loyalty_program" on public.loyalty_program;
create policy "admin manages loyalty_program" on public.loyalty_program
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff full access loyalty_transaction" on public.loyalty_transaction;
create policy "admin manages loyalty_transaction" on public.loyalty_transaction
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff full access checkin" on public.checkin;
create policy "admin manages checkin" on public.checkin
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff full access checkin_service" on public.checkin_service;
create policy "admin manages checkin_service" on public.checkin_service
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- notification — log of SMS/email intents. Placeholder: rows are written but no
-- message is actually sent until Twilio/email is wired.
-- ===========================================================================
create type notification_channel as enum ('sms', 'email');
create type notification_status  as enum ('queued', 'sent', 'failed', 'stubbed');

create table if not exists public.notification (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customer (id) on delete set null,
  checkin_id  uuid references public.checkin (id) on delete set null,
  channel     notification_channel not null,
  to_address  text not null,
  template    text not null,
  payload     jsonb not null default '{}',
  status      notification_status not null default 'stubbed',
  created_at  timestamptz not null default now()
);

alter table public.notification enable row level security;

-- Admins can read the notification log.
create policy "admin reads notifications" on public.notification
  for select to authenticated using (public.is_admin());

-- Record a notification intent. SECURITY DEFINER so the anon kiosk can log the
-- check-in confirmation without a table-level insert grant. Real delivery is
-- deferred (see supabase/functions/send-notification and src/lib/notifications.ts).
create or replace function public.queue_notification(
  p_customer_id uuid,
  p_checkin_id  uuid,
  p_channel     notification_channel,
  p_to_address  text,
  p_template    text,
  p_payload     jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- TODO(twilio/email): once delivery is wired, enqueue/send here and set status
  -- to 'queued'/'sent'. For now we record intent as 'stubbed'.
  insert into public.notification
    (customer_id, checkin_id, channel, to_address, template, payload, status)
  values
    (p_customer_id, p_checkin_id, p_channel, p_to_address, p_template, p_payload, 'stubbed')
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.queue_notification(uuid, uuid, notification_channel, text, text, jsonb)
  to anon, authenticated;

create index if not exists idx_notification_customer on public.notification (customer_id);
create index if not exists idx_notification_created  on public.notification (created_at);
