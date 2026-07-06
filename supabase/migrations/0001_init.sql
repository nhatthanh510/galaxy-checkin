-- Galaxy Check-In — consolidated schema (fresh DB).
-- This single file is the final state of the DB, collapsing the original
-- 0001–0012 migrations (dev-time squash). Row Level Security is enabled on every
-- table. The kiosk uses the anon role over a minimal path (SECURITY DEFINER
-- RPCs); admin routes require an authenticated session with profile.is_admin.
--
-- NOTE — intentional design: the anon self-serve RPCs (redeem_points,
-- claim_birthday) take only a customer id (no phone/ownership check). Anyone
-- with the public anon key can redeem/claim for any customer by UUID. This is an
-- accepted product tradeoff for kiosk simplicity (low blast radius: loyalty
-- points, not money/data). See CLAUDE.md.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ===========================================================================
-- Enum types
-- ===========================================================================
create type checkin_status        as enum ('waiting', 'in_service', 'completed', 'cancelled');
create type notification_channel  as enum ('sms', 'email');
create type notification_status   as enum ('queued', 'sent', 'failed', 'stubbed');
create type reward_type           as enum ('fixed', 'percent');

-- ===========================================================================
-- Tables
-- ===========================================================================

-- customer — identified by phone (primary lookup key).
create table public.customer (
  id                     uuid primary key default gen_random_uuid(),
  phone                  text not null unique,
  name                   text not null,
  visit_count            integer not null default 0,
  points_balance         integer not null default 0,
  birthday               date,
  birthday_redeemed_year integer,             -- year the birthday benefit was last claimed
  marketing_consent      boolean not null default false,
  created_at             timestamptz not null default now()
);

-- service_group — kiosk service categories (a proper entity).
create table public.service_group (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  active boolean not null default true
);

-- service — offerings, assigned to a group.
create table public.service (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         text not null,             -- legacy/denormalized group label
  group_id         uuid references public.service_group (id) on delete set null,
  price            numeric(10, 2) not null default 0,
  duration_minutes integer not null default 0,
  active           boolean not null default true
);

-- technician — staff who perform services.
create table public.technician (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  active    boolean not null default true,
  photo_url text
);

-- checkin — one visit; drives the queue.
create table public.checkin (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customer (id) on delete cascade,
  technician_id uuid references public.technician (id) on delete set null,
  status        checkin_status not null default 'waiting',
  created_at    timestamptz not null default now()
);

-- checkin_service — services selected per checkin (many-to-many).
create table public.checkin_service (
  checkin_id uuid not null references public.checkin (id) on delete cascade,
  service_id uuid not null references public.service (id) on delete cascade,
  primary key (checkin_id, service_id)
);

-- loyalty_program — earn/redeem rules. Multiple may be active.
--   reward_type = 'fixed'   -> reward_value is dollars ($10 off)
--   reward_type = 'percent' -> reward_value is a percentage (20% off)
create table public.loyalty_program (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text not null,
  points_per_reward integer not null,
  reward_type       reward_type not null default 'fixed',
  reward_value      numeric(10, 2) not null default 0,
  reward_amount     numeric(10, 2) not null default 0, -- legacy, kept in sync
  active            boolean not null default true
);

-- loyalty_transaction — signed points earned/redeemed/adjusted per customer.
create table public.loyalty_transaction (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer (id) on delete cascade,
  checkin_id  uuid references public.checkin (id) on delete set null,
  amount      integer not null, -- signed: + earned, - redeemed
  reason      text not null,
  created_at  timestamptz not null default now()
);

-- profile — one row per auth user; carries the is_admin flag.
create table public.profile (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- app_settings — single-row app-wide config (birthday "soon" window, in days).
create table public.app_settings (
  id                   boolean primary key default true,
  birthday_days_before integer not null default 7,
  birthday_days_after  integer not null default 7,
  updated_at           timestamptz not null default now(),
  constraint app_settings_singleton check (id = true)
);
insert into public.app_settings (id) values (true);

-- notification — log of SMS intents/results (delivery via ClickSend edge fn).
create table public.notification (
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

-- Indexes for the queue and lookups.
create index idx_checkin_status       on public.checkin (status);
create index idx_checkin_created_at   on public.checkin (created_at);
create index idx_customer_phone       on public.customer (phone);
create index idx_notification_customer on public.notification (customer_id);
create index idx_notification_created  on public.notification (created_at);

-- ===========================================================================
-- Helper functions
-- ===========================================================================

-- is_admin() — is the current user an admin? SECURITY DEFINER so it can read
-- profile regardless of the caller's own RLS. Used inside policies.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profile p where p.id = auth.uid()), false);
$$;

-- Auto-provision a profile row when a new auth user is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.customer            enable row level security;
alter table public.service             enable row level security;
alter table public.service_group       enable row level security;
alter table public.technician          enable row level security;
alter table public.checkin             enable row level security;
alter table public.checkin_service     enable row level security;
alter table public.loyalty_program     enable row level security;
alter table public.loyalty_transaction enable row level security;
alter table public.profile             enable row level security;
alter table public.app_settings        enable row level security;
alter table public.notification        enable row level security;

-- --- Kiosk (anon) reads: only the active catalog + settings ----------------
create policy "anon reads active services" on public.service
  for select to anon using (active = true);
create policy "anon reads active service groups" on public.service_group
  for select to anon using (active = true);
create policy "anon reads active technicians" on public.technician
  for select to anon using (active = true);
create policy "anon reads active loyalty program" on public.loyalty_program
  for select to anon using (active = true);
create policy "anyone reads settings" on public.app_settings
  for select to anon, authenticated using (true);
-- (anon touches customer/checkin only via the SECURITY DEFINER RPCs below.)

-- --- Admin (authenticated + is_admin) manages data -------------------------
create policy "admin manages customer" on public.customer
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manages service" on public.service
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manages service_group" on public.service_group
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manages technician" on public.technician
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manages checkin" on public.checkin
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manages checkin_service" on public.checkin_service
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manages loyalty_program" on public.loyalty_program
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manages loyalty_transaction" on public.loyalty_transaction
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin updates settings" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin reads notifications" on public.notification
  for select to authenticated using (public.is_admin());

-- --- Profile ----------------------------------------------------------------
create policy "read own profile" on public.profile
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profile
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ===========================================================================
-- Kiosk RPCs (SECURITY DEFINER) — the only anon path touching customer data.
-- ===========================================================================

-- Look up a single customer by phone. Returns 0 or 1 row.
create function public.lookup_customer_by_phone(p_phone text)
returns setof public.customer
language sql
stable
security definer
set search_path = public
as $$
  select * from public.customer where phone = p_phone limit 1;
$$;

-- create_checkin — upsert customer by phone, create the checkin (status
-- `waiting`), link services, award +1 point, record consent/birthday.
create function public.create_checkin(
  p_phone         text,
  p_name          text,
  p_service_ids   uuid[] default '{}',
  p_technician_id uuid   default null,
  p_birthday      date   default null,
  p_consent       boolean default false
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
  v_points_per_checkin integer := 1;
begin
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone is required';
  end if;

  select * into v_customer from public.customer where phone = p_phone for update;
  if v_customer.id is null then
    insert into public.customer
      (phone, name, visit_count, points_balance, birthday, marketing_consent)
    values
      (p_phone, coalesce(nullif(trim(p_name), ''), 'Guest'), 1, v_points_per_checkin,
       p_birthday, p_consent)
    returning * into v_customer;
  else
    update public.customer
      set visit_count       = customer.visit_count + 1,
          points_balance    = customer.points_balance + v_points_per_checkin,
          birthday          = coalesce(customer.birthday, p_birthday),
          marketing_consent = p_consent
      where id = v_customer.id
      returning * into v_customer;
  end if;

  insert into public.checkin (customer_id, technician_id, status)
  values (v_customer.id, p_technician_id, 'waiting')
  returning id into v_checkin_id;

  if p_service_ids is not null then
    foreach v_service_id in array p_service_ids loop
      insert into public.checkin_service (checkin_id, service_id)
      values (v_checkin_id, v_service_id)
      on conflict do nothing;
    end loop;
  end if;

  insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
  values (v_customer.id, v_checkin_id, v_points_per_checkin, 'Earned at check-in');

  return query
    select v_checkin_id, v_customer.id, v_customer.name,
           v_customer.points_balance, v_customer.visit_count;
end;
$$;

-- redeem_points — redeem a specific active program's reward (subtract its
-- threshold, keep surplus, log it). Row-locked. No ownership check (see NOTE).
create function public.redeem_points(
  p_customer_id uuid,
  p_program_id  uuid default null
)
returns table (
  points_balance  integer,
  redeemed_points integer,
  reward_type     reward_type,
  reward_value    numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customer;
  v_program  public.loyalty_program;
begin
  select * into v_customer from public.customer where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found';
  end if;

  if p_program_id is not null then
    select * into v_program from public.loyalty_program
      where id = p_program_id and active = true;
  else
    select * into v_program from public.loyalty_program
      where active = true order by name limit 1;
  end if;

  if v_program.id is null then
    raise exception 'no matching active loyalty program';
  end if;

  if v_customer.points_balance < v_program.points_per_reward then
    raise exception 'not enough points to redeem (have %, need %)',
      v_customer.points_balance, v_program.points_per_reward;
  end if;

  update public.customer
    set points_balance = customer.points_balance - v_program.points_per_reward
    where id = p_customer_id
    returning * into v_customer;

  insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
  values (p_customer_id, null, -v_program.points_per_reward, 'Redeemed: ' || v_program.name);

  return query
    select v_customer.points_balance, v_program.points_per_reward,
           v_program.reward_type, v_program.reward_value;
end;
$$;

-- claim_birthday — mark the birthday discount used for the current year.
create function public.claim_birthday(p_customer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
begin
  update public.customer set birthday_redeemed_year = v_year where id = p_customer_id;
  if not found then
    raise exception 'customer not found';
  end if;

  insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
  values (p_customer_id, null, 0, 'Birthday discount claimed');

  return v_year;
end;
$$;

-- queue_notification — record a notification intent (status 'stubbed'). Legacy
-- path; the app now invokes the send-notification edge function directly, but
-- this is kept for the anon fallback.
create function public.queue_notification(
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
  insert into public.notification
    (customer_id, checkin_id, channel, to_address, template, payload, status)
  values
    (p_customer_id, p_checkin_id, p_channel, p_to_address, p_template, p_payload, 'stubbed')
  returning id into v_id;
  return v_id;
end;
$$;

-- ===========================================================================
-- Admin RPC — edit a customer while keeping the loyalty ledger consistent.
-- ===========================================================================
create function public.admin_update_customer(
  p_customer_id    uuid,
  p_name           text,
  p_points_balance integer,
  p_birthday       date default null
)
returns public.customer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customer;
  v_delta    integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_customer from public.customer where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found';
  end if;

  v_delta := p_points_balance - v_customer.points_balance;

  update public.customer
    set name = p_name, points_balance = p_points_balance, birthday = p_birthday
    where id = p_customer_id
    returning * into v_customer;

  if v_delta <> 0 then
    insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
    values (p_customer_id, null, v_delta, 'Admin adjustment');
  end if;

  return v_customer;
end;
$$;

-- ===========================================================================
-- Grants — anon (kiosk) + authenticated may call the self-serve RPCs; admin
-- edit is authenticated-only.
-- ===========================================================================
grant execute on function public.lookup_customer_by_phone(text) to anon, authenticated;
grant execute on function public.create_checkin(text, text, uuid[], uuid, date, boolean) to anon, authenticated;
grant execute on function public.redeem_points(uuid, uuid) to anon, authenticated;
grant execute on function public.claim_birthday(uuid) to anon, authenticated;
grant execute on function public.queue_notification(uuid, uuid, notification_channel, text, text, jsonb) to anon, authenticated;
grant execute on function public.admin_update_customer(uuid, text, integer, date) to authenticated;
