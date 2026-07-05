-- Galaxy Check-In — initial schema.
-- Source of truth for the DB (per CLAUDE.md). Row Level Security is enabled on
-- every table. The kiosk uses the anon role over a minimal public path; staff
-- routes require an authenticated session.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- customer — identified by phone number (primary lookup key).
-- ---------------------------------------------------------------------------
create table if not exists public.customer (
  id             uuid primary key default gen_random_uuid(),
  phone          text not null unique,
  name           text not null,
  visit_count    integer not null default 0,
  points_balance integer not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- service — offerings grouped by category.
-- ---------------------------------------------------------------------------
create table if not exists public.service (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         text not null,
  price            numeric(10, 2) not null default 0,
  duration_minutes integer not null default 0,
  active           boolean not null default true
);

-- ---------------------------------------------------------------------------
-- technician — staff who perform services.
-- ---------------------------------------------------------------------------
create table if not exists public.technician (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  active    boolean not null default true,
  photo_url text
);

-- ---------------------------------------------------------------------------
-- checkin — one visit; drives the queue.
-- ---------------------------------------------------------------------------
create type checkin_status as enum ('waiting', 'in_service', 'completed', 'cancelled');

create table if not exists public.checkin (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customer (id) on delete cascade,
  technician_id uuid references public.technician (id) on delete set null,
  status        checkin_status not null default 'waiting',
  created_at    timestamptz not null default now()
);

-- Selected services per checkin (many-to-many).
create table if not exists public.checkin_service (
  checkin_id uuid not null references public.checkin (id) on delete cascade,
  service_id uuid not null references public.service (id) on delete cascade,
  primary key (checkin_id, service_id)
);

-- ---------------------------------------------------------------------------
-- loyalty_program — single active earn/redeem rule.
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_program (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text not null,
  points_per_reward integer not null,
  reward_amount     numeric(10, 2) not null,
  active            boolean not null default true
);

-- ---------------------------------------------------------------------------
-- loyalty_transaction — points earned/redeemed per checkin.
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_transaction (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer (id) on delete cascade,
  checkin_id  uuid references public.checkin (id) on delete set null,
  amount      integer not null, -- signed: + earned, - redeemed
  reason      text not null,
  created_at  timestamptz not null default now()
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.customer            enable row level security;
alter table public.service             enable row level security;
alter table public.technician          enable row level security;
alter table public.checkin             enable row level security;
alter table public.checkin_service     enable row level security;
alter table public.loyalty_program     enable row level security;
alter table public.loyalty_transaction enable row level security;

-- --- Kiosk (anon) path ------------------------------------------------------
-- Read the catalog needed to render the flow.
create policy "anon reads active services" on public.service
  for select to anon using (active = true);

create policy "anon reads active technicians" on public.technician
  for select to anon using (active = true);

create policy "anon reads active loyalty program" on public.loyalty_program
  for select to anon using (active = true);

-- The minimal public check-in path: create the customer + checkin. Note we do
-- NOT grant anon a broad SELECT on customer (no exposing other customers'
-- data). Phone lookup on the kiosk is performed by a SECURITY DEFINER RPC
-- (added in a later pass) that returns only the single matching row.
create policy "anon creates customers" on public.customer
  for insert to anon with check (true);

create policy "anon creates checkins" on public.checkin
  for insert to anon with check (true);

create policy "anon links checkin services" on public.checkin_service
  for insert to anon with check (true);

-- --- Staff (authenticated) path --------------------------------------------
-- Broad read/write for the staff dashboard (built in a later pass).
create policy "staff full access customer" on public.customer
  for all to authenticated using (true) with check (true);

create policy "staff full access service" on public.service
  for all to authenticated using (true) with check (true);

create policy "staff full access technician" on public.technician
  for all to authenticated using (true) with check (true);

create policy "staff full access checkin" on public.checkin
  for all to authenticated using (true) with check (true);

create policy "staff full access checkin_service" on public.checkin_service
  for all to authenticated using (true) with check (true);

create policy "staff full access loyalty_program" on public.loyalty_program
  for all to authenticated using (true) with check (true);

create policy "staff full access loyalty_transaction" on public.loyalty_transaction
  for all to authenticated using (true) with check (true);

-- Helpful indexes for the queue and lookups.
create index if not exists idx_checkin_status     on public.checkin (status);
create index if not exists idx_checkin_created_at on public.checkin (created_at);
create index if not exists idx_customer_phone     on public.customer (phone);
