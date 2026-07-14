-- Multi-branch check-in ------------------------------------------------------
-- The salon now runs more than one physical branch (e.g. Kings Meadows,
-- Brisbane), each with its own kiosk tablet. A branch belongs to a *visit*, not
-- to a customer: the customer stays one global record (one phone, one shared
-- loyalty balance across branches) and each check-in stamps where it happened.
--
-- Branches are created/managed by admins in the UI (/admin/branches) — NOT
-- seeded here — so the salon defines its own names. checkin.branch_id is
-- nullable: an unassigned tablet (or any non-kiosk caller, or a historical row)
-- records a branchless check-in, which reports surface as "Unassigned".
--
-- This migration also: (a) records a kiosk check-in as 'completed' rather than
-- 'waiting' (there is no staff live-queue transition — the visit is done at
-- check-in), and (b) denormalizes the last visit's branch onto the customer so
-- the admin list can show "last visited <date> at <branch>".

-- branch — a physical location. `slug` is a stable, kebab-case id the kiosk
-- tablet stores in localStorage; it's derived from the name on create (unique).
-- `if not exists` so a partial/re-run apply doesn't error on an existing table.
create table if not exists public.branch (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- checkin.branch_id — where the visit happened. Nullable (null = unassigned).
-- on delete set null so removing a branch never destroys visit history.
alter table public.checkin
  add column if not exists branch_id uuid references public.branch (id) on delete set null;

-- Backfill: existing kiosk check-ins were created as 'waiting', but there is no
-- staff live-queue that ever moves them on — so 'waiting' is a stale state. From
-- now on create_checkin records 'completed' (below); make history consistent by
-- completing every past 'waiting' visit. (Imported visits are already
-- 'completed'; 'cancelled' rows, if any, are left untouched.)
update public.checkin set status = 'completed' where status = 'waiting';

-- Supports the per-day, per-branch report/filter reads.
create index if not exists idx_checkin_branch_created_at
  on public.checkin (branch_id, created_at);

-- customer.last_visit_branch_id — the branch of the customer's MOST RECENT visit,
-- denormalized alongside last_visit_at (0006) so the admin customer list can show
-- "last visited 14/07/2026 at Brisbane" without a per-row join. Kept fresh by the
-- touch trigger below. Nullable (the last visit may be branchless, or predate
-- branches). on delete set null so removing a branch keeps the customer row.
alter table public.customer
  add column if not exists last_visit_branch_id uuid references public.branch (id) on delete set null;

-- Extend the last-visit trigger (0006) to also stamp the branch when THIS insert
-- is the new most-recent visit. Guard on the timestamp so an out-of-order insert
-- (e.g. a backfilled/imported older visit) doesn't overwrite a newer branch.
create or replace function public.touch_customer_last_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customer
    set last_visit_at = greatest(coalesce(last_visit_at, new.created_at), new.created_at),
        last_visit_branch_id = case
          when last_visit_at is null or new.created_at >= last_visit_at
            then new.branch_id
          else last_visit_branch_id
        end
    where id = new.customer_id;
  return new;
end;
$$;

-- ===========================================================================
-- Row Level Security (added together with the table, per project convention)
-- ===========================================================================
alter table public.branch enable row level security;

-- Kiosk (anon) + staff read active branches: the tablet resolves its stored
-- slug -> id, and the setup screen lists branches to pick from.
-- (drop-then-create so a re-run doesn't error on an existing policy.)
drop policy if exists "anyone reads active branches" on public.branch;
create policy "anyone reads active branches" on public.branch
  for select to anon, authenticated using (active = true);

-- Admins manage branches (create/rename/activate) from the admin UI.
drop policy if exists "admin manages branch" on public.branch;
create policy "admin manages branch" on public.branch
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- (checkin RLS is unchanged: "admin manages checkin" already covers the new
--  column, and the kiosk writes checkins only through create_checkin below.)

-- ===========================================================================
-- create_checkin — add p_branch_id so the kiosk stamps the visit's branch.
-- ===========================================================================
-- The current definition (0015) returns 6 columns and takes 8 args. Adding a
-- parameter creates a new overload, so DROP the 8-arg signature first, then
-- recreate 9-arg and re-grant (the 0013/0015 pattern). Return type is unchanged.
-- Drop BOTH the old 8-arg signature AND any existing 9-arg one, so a re-run after
-- a partial apply (which may have already created the 9-arg version) doesn't hit
-- "function already exists with same argument types".
drop function if exists public.create_checkin(
  text, text, uuid[], uuid, date, boolean, boolean, timestamptz
);
drop function if exists public.create_checkin(
  text, text, uuid[], uuid, date, boolean, boolean, timestamptz, uuid
);

create function public.create_checkin(
  p_phone         text,
  p_name          text,
  p_service_ids   uuid[]      default '{}',
  p_technician_id uuid        default null,
  p_birthday      date        default null,
  p_consent       boolean     default false,
  p_award_point   boolean     default true,
  p_day_start     timestamptz default null,
  p_branch_id     uuid        default null
)
returns table (
  checkin_id      uuid,
  customer_id     uuid,
  customer_name   text,
  points_balance  integer,
  visit_count     integer,
  lifetime_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customer;
  v_checkin_id uuid;
  v_service_id uuid;
  v_points integer := case when p_award_point then 1 else 0 end;
begin
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone is required';
  end if;

  select * into v_customer from public.customer where phone = p_phone for update;

  -- One check-in per client-local day. Alias the table so customer_id is
  -- unambiguous against the function's OUT column of the same name. The guard is
  -- by customer + day regardless of branch: a customer can't check in twice the
  -- same day even across branches.
  if v_customer.id is not null and p_day_start is not null and exists (
    select 1 from public.checkin c
    where c.customer_id = v_customer.id
      and c.created_at >= p_day_start
  ) then
    raise exception 'already_checked_in_today'
      using errcode = 'P0001',
            hint = 'This customer has already checked in today.';
  end if;

  if v_customer.id is null then
    insert into public.customer
      (phone, name, visit_count, points_balance, lifetime_points, birthday, marketing_consent)
    values
      (p_phone, coalesce(nullif(trim(p_name), ''), 'Guest'), 1, v_points, v_points,
       p_birthday, p_consent)
    returning * into v_customer;
  else
    update public.customer
      set visit_count       = customer.visit_count + 1,
          points_balance    = customer.points_balance + v_points,
          lifetime_points   = customer.lifetime_points + v_points,
          birthday          = coalesce(customer.birthday, p_birthday),
          marketing_consent = p_consent
      where id = v_customer.id
      returning * into v_customer;
  end if;

  -- Status 'completed': there's no staff live-queue transition, so a kiosk
  -- check-in is a finished visit (not a queued 'waiting' one).
  insert into public.checkin (customer_id, technician_id, status, branch_id)
  values (v_customer.id, p_technician_id, 'completed', p_branch_id)
  returning id into v_checkin_id;

  if p_service_ids is not null then
    foreach v_service_id in array p_service_ids loop
      insert into public.checkin_service (checkin_id, service_id)
      values (v_checkin_id, v_service_id)
      on conflict do nothing;
    end loop;
  end if;

  if v_points > 0 then
    insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
    values (v_customer.id, v_checkin_id, v_points, 'Earned at check-in');
  end if;

  return query
    select v_checkin_id, v_customer.id, v_customer.name,
           v_customer.points_balance, v_customer.visit_count,
           v_customer.lifetime_points;
end;
$$;

-- Re-grant (DROP removed the prior grant). Matches 0015: authenticated only —
-- the kiosk runs as an authenticated staff session.
grant execute on function
  public.create_checkin(text, text, uuid[], uuid, date, boolean, boolean, timestamptz, uuid)
  to authenticated;
