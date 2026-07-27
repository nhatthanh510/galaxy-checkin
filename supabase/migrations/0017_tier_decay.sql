-- Tier maintenance / inactivity decay + audit log + manual lock ---------------
-- Until now a customer's tier (New/Regular/VIP) was a *pure function* of
-- lifetime_points (src/lib/tier.ts: New <5, Regular 5..19, VIP >=20), and
-- lifetime_points only ever increases -- so a tier could never drop. Some
-- customers earn VIP, stop visiting for months, and reappear only on their
-- birthday to claim the full VIP birthday discount.
--
-- This migration makes tier "earned by loyalty but MAINTAINED by activity":
-- tier is now a PERSISTED customer.tier column, driven by one rule --
--
--   earned  = tier from lifetime_points        (a CEILING)
--   allowed = tier from trailing-window visits  (n >= vip_min -> VIP,
--                                                n >= reg_min -> Regular, else New)
--   target  = min(earned, allowed)              (New < Regular < VIP)
--   next    = current tier stepped ONE level toward target  (one level per run)
--
-- Two things move the column, both via the SAME one-step rule so they can't
-- drift: (1) create_checkin recomputes the checking-in customer (prompt upgrades),
-- and (2) a monthly pg_cron job recomputes everyone (decays the inactive, who
-- never hit path 1). The window (6 months) and thresholds (5 / 3 visits) are
-- admin-configurable on app_settings, next to the birthday percents (0015).
--
-- Also here:
--   * tier_change -- an audit row for every automatic OR manual tier move, listed
--     on the admin "Tier changes" page.
--   * customer.tier_locked -- an admin pin that EXEMPTS a customer from the auto
--     flow entirely (both decay and upgrade), for comping a specific VIP.
--   * admin_preview_tier_review() / admin_apply_tier_review(ids) -- dry-run a
--     review then apply it to a chosen subset from the admin UI.
--   * admin_set_tier() -- set + lock a customer's tier manually.
--
-- All DDL is idempotent (guarded) per project convention; applied to the hosted
-- DB via `supabase db push` and may be re-run.

-- 1. Tier math helpers -------------------------------------------------------
-- SQL twins of src/lib/tier.ts. Keep the thresholds here in sync with that file.
create or replace function public.tier_from_lifetime_points(p_lifetime integer)
returns text language sql immutable as $$
  select case
    when coalesce(p_lifetime, 0) < 5  then 'new'
    when coalesce(p_lifetime, 0) < 20 then 'regular'
    else 'vip'
  end;
$$;

create or replace function public.tier_rank(p_tier text)
returns integer language sql immutable as $$
  select case p_tier when 'vip' then 2 when 'regular' then 1 else 0 end;
$$;

create or replace function public.tier_from_rank(p_rank integer)
returns text language sql immutable as $$
  select case p_rank when 2 then 'vip' when 1 then 'regular' else 'new' end;
$$;

-- next_tier: the whole rule in one place. Given the current tier, the trailing-
-- window visit count (n), lifetime points, and the two thresholds, return the
-- current tier stepped AT MOST one level toward target = min(earned, allowed).
create or replace function public.next_tier(
  p_current  text,
  p_n        integer,
  p_lifetime integer,
  p_vip_min  integer,
  p_reg_min  integer
) returns text language plpgsql immutable as $$
declare
  v_allowed_rank integer;
  v_earned_rank  integer;
  v_target_rank  integer;
  v_current_rank integer;
begin
  -- Activity gate: how high recent visits let the customer stand.
  if    p_n >= p_vip_min then v_allowed_rank := 2;
  elsif p_n >= p_reg_min then v_allowed_rank := 1;
  else                        v_allowed_rank := 0;
  end if;

  -- Earned ceiling: activity can't push a customer above what points earned.
  v_earned_rank  := public.tier_rank(public.tier_from_lifetime_points(p_lifetime));
  v_target_rank  := least(v_allowed_rank, v_earned_rank);
  v_current_rank := public.tier_rank(p_current);

  -- Step ONE level toward target (down for decay, up for recovery).
  if    v_current_rank > v_target_rank then v_current_rank := v_current_rank - 1;
  elsif v_current_rank < v_target_rank then v_current_rank := v_current_rank + 1;
  end if;

  return public.tier_from_rank(v_current_rank);
end;
$$;

-- 2. Persisted tier column + manual lock -------------------------------------
alter table public.customer
  add column if not exists tier text not null default 'new';
alter table public.customer
  drop constraint if exists customer_tier_check;
alter table public.customer
  add constraint customer_tier_check check (tier in ('new', 'regular', 'vip'));

-- tier_locked: when true, an admin has pinned this customer's tier -- the auto
-- flow (decay AND upgrade) skips them entirely until it's unlocked.
alter table public.customer
  add column if not exists tier_locked boolean not null default false;

-- Backfill existing rows to their EARNED tier, so nobody is spuriously
-- downgraded on day one; decay begins only as the monthly job finds them
-- inactive. (Safe to re-run: it just recomputes the earned tier.)
update public.customer set tier = public.tier_from_lifetime_points(lifetime_points);

-- 3. Configurable window + thresholds (mirrors 0015 birthday percents) -------
-- Visit thresholds default to 0 = PAUSED: with a 0 threshold every customer's
-- activity "allows" that tier, so the review never downgrades anyone. This is
-- how automatic decay is switched off (e.g. right after launch, while imported
-- check-in history is still incomplete). Raise to 5 / 3 in the admin Settings
-- page when ready (the trailing window is full of real check-ins by then).
alter table public.app_settings
  add column if not exists tier_window_months      integer not null default 6,
  add column if not exists tier_vip_min_visits      integer not null default 0,
  add column if not exists tier_regular_min_visits  integer not null default 0;

alter table public.app_settings
  drop constraint if exists app_settings_tier_range;
alter table public.app_settings
  add constraint app_settings_tier_range check (
    tier_window_months     between 1 and 60 and
    tier_vip_min_visits     between 0 and 1000 and
    tier_regular_min_visits between 0 and 1000
  );

-- 4. tier_change audit log ---------------------------------------------------
-- One row per tier movement (a decay on the monthly review, an upgrade/recovery
-- at check-in, or a manual admin set). Admin-only read; written only by the
-- SECURITY DEFINER functions below.
create table if not exists public.tier_change (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customer (id) on delete cascade,
  from_tier        text not null,
  to_tier          text not null,
  -- 'review' = monthly run_tier_review, 'checkin' = recompute at check-in,
  -- 'manual' = admin_set_tier.
  source           text not null,
  -- The trailing-window visit count at the time, for context (null for manual).
  visits_in_window integer,
  created_at       timestamptz not null default now()
);

create index if not exists idx_tier_change_created_at on public.tier_change (created_at desc);
create index if not exists idx_tier_change_customer   on public.tier_change (customer_id);

alter table public.tier_change enable row level security;

drop policy if exists "admin reads tier changes" on public.tier_change;
create policy "admin reads tier changes" on public.tier_change
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policy: only SECURITY DEFINER functions write here.

-- 5. Recompute one customer's tier (used by create_checkin) ------------------
-- Counts the customer's non-cancelled check-ins in the trailing window, applies
-- next_tier, and -- when the tier actually moves -- updates + logs it. Skips
-- locked customers. SECURITY DEFINER so create_checkin (kiosk) can call it.
create or replace function public.recompute_customer_tier(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window   integer;
  v_vip_min  integer;
  v_reg_min  integer;
  v_n        integer;
  v_lifetime integer;
  v_current  text;
  v_locked   boolean;
  v_next     text;
begin
  select tier_window_months, tier_vip_min_visits, tier_regular_min_visits
    into v_window, v_vip_min, v_reg_min
    from public.app_settings where id = true;
  v_window  := coalesce(v_window, 6);
  v_vip_min := coalesce(v_vip_min, 5);
  v_reg_min := coalesce(v_reg_min, 3);

  select lifetime_points, tier, tier_locked
    into v_lifetime, v_current, v_locked
    from public.customer where id = p_customer_id;
  if not found then return; end if;
  if coalesce(v_locked, false) then return; end if;  -- pinned: never auto-adjust

  select count(*) into v_n
    from public.checkin
    where customer_id = p_customer_id
      and status <> 'cancelled'
      and created_at >= now() - make_interval(months => v_window);

  v_next := public.next_tier(v_current, v_n, coalesce(v_lifetime, 0), v_vip_min, v_reg_min);

  if v_next <> v_current then
    update public.customer set tier = v_next where id = p_customer_id;
    insert into public.tier_change (customer_id, from_tier, to_tier, source, visits_in_window)
    values (p_customer_id, v_current, v_next, 'checkin', v_n);
  end if;
end;
$$;

-- 6. Monthly review: recompute EVERY (unlocked) customer ---------------------
-- Pure SQL (no SMS/pg_net/edge function needed, unlike the birthday cron). A
-- set-based UPDATE joining a windowed count, logging each change. Returns the
-- number of customers whose tier changed. SECURITY DEFINER so cron can run it.
create or replace function public.run_tier_review()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window  integer;
  v_vip_min integer;
  v_reg_min integer;
  v_changed integer;
begin
  select tier_window_months, tier_vip_min_visits, tier_regular_min_visits
    into v_window, v_vip_min, v_reg_min
    from public.app_settings where id = true;
  v_window  := coalesce(v_window, 6);
  v_vip_min := coalesce(v_vip_min, 5);
  v_reg_min := coalesce(v_reg_min, 3);

  with counts as (
    select c.id,
           count(*) filter (
             where ck.id is not null
               and ck.status <> 'cancelled'
               and ck.created_at >= now() - make_interval(months => v_window)
           ) as n,
           c.tier as current_tier,
           coalesce(c.lifetime_points, 0) as lifetime
    from public.customer c
    left join public.checkin ck on ck.customer_id = c.id
    where not coalesce(c.tier_locked, false)   -- pinned customers are exempt
    group by c.id
  ),
  updated as (
    update public.customer cust
      set tier = public.next_tier(counts.current_tier, counts.n::integer,
                                  counts.lifetime, v_vip_min, v_reg_min)
      from counts
      where counts.id = cust.id
        and cust.tier <> public.next_tier(counts.current_tier, counts.n::integer,
                                          counts.lifetime, v_vip_min, v_reg_min)
      returning cust.id as customer_id, counts.current_tier as from_tier,
                cust.tier as to_tier, counts.n as n
  ),
  logged as (
    insert into public.tier_change (customer_id, from_tier, to_tier, source, visits_in_window)
    select customer_id, from_tier, to_tier, 'review', n from updated
    returning 1
  )
  select count(*) into v_changed from logged;
  return v_changed;
end;
$$;

-- 7. Initial tier on insert --------------------------------------------------
-- Every insert path (kiosk new customer, import_customers, CSV upsert) should
-- start a customer at their EARNED tier. A BEFORE INSERT trigger sets it from
-- lifetime_points so we don't have to touch each inserting function. INSERT
-- only, so ongoing decay (an UPDATE of tier) is never clobbered.
create or replace function public.set_initial_customer_tier()
returns trigger
language plpgsql
as $$
begin
  new.tier := public.tier_from_lifetime_points(new.lifetime_points);
  return new;
end;
$$;

drop trigger if exists trg_customer_set_initial_tier on public.customer;
create trigger trg_customer_set_initial_tier
  before insert on public.customer
  for each row execute function public.set_initial_customer_tier();

-- 8. create_checkin: recompute + return the tier -----------------------------
-- The kiosk success screen needs the customer's post-check-in tier (for the
-- birthday reward percent + the member badge). Add a `tier` OUT column and
-- recompute the customer AFTER the visit is inserted (so it counts). Changing
-- the return row type requires DROP first (per 0015/0016). Drop the current
-- 9-arg signature; the arg list is unchanged so the drop targets it exactly.
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
  lifetime_points integer,
  tier            text
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

  -- Recompute tier now that this visit is recorded (counts toward the window,
  -- and the fresh point may raise the earned ceiling). One step toward target;
  -- a no-op for locked customers.
  perform public.recompute_customer_tier(v_customer.id);

  return query
    select v_checkin_id, v_customer.id, v_customer.name,
           v_customer.points_balance, v_customer.visit_count,
           v_customer.lifetime_points,
           (select c.tier from public.customer c where c.id = v_customer.id);
end;
$$;

-- Re-grant (DROP removed the prior grant). Matches 0016: authenticated only --
-- the kiosk runs as an authenticated staff session.
grant execute on function
  public.create_checkin(text, text, uuid[], uuid, date, boolean, boolean, timestamptz, uuid)
  to authenticated;

-- 9. Cleanup -- drop the retired on-demand review wrapper -------------------
-- Earlier iterations shipped admin_run_tier_review() (a "Run review now" button);
-- the UI now uses the Preview + Apply flow instead. Drop it so DBs that ran an
-- earlier version of this migration don't keep the dead function.
drop function if exists public.admin_run_tier_review();

-- 10. admin_set_tier -- manually set + (un)lock a customer's tier ------------
-- Setting a tier here also flips tier_locked: a locked customer is pinned and
-- exempt from the auto flow. Logs a 'manual' tier_change when the tier moves.
create or replace function public.admin_set_tier(
  p_customer_id uuid,
  p_tier        text,
  p_locked      boolean
)
returns public.customer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customer;
  v_old      text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_tier not in ('new', 'regular', 'vip') then
    raise exception 'invalid tier: %', p_tier;
  end if;

  select * into v_customer from public.customer where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found';
  end if;
  v_old := v_customer.tier;

  update public.customer
    set tier = p_tier, tier_locked = coalesce(p_locked, false)
    where id = p_customer_id
    returning * into v_customer;

  if p_tier <> v_old then
    insert into public.tier_change (customer_id, from_tier, to_tier, source, visits_in_window)
    values (p_customer_id, v_old, p_tier, 'manual', null);
  end if;

  return v_customer;
end;
$$;

grant execute on function public.admin_set_tier(uuid, text, boolean) to authenticated;

-- 11. Admin preview + selective apply of a review ----------------------------
-- The admin UI can preview exactly which customers a review WOULD move (a
-- read-only dry run), let the admin unselect some, then apply only the chosen
-- ids -- all using the same one-step next_tier rule as the automatic flow.
-- Locked customers are excluded from both. Both are is_admin() guarded.

-- Drop first: an earlier version returned fewer columns (no last_visit_at), and
-- Postgres won't let CREATE OR REPLACE change a function's return type. This
-- keeps the migration re-runnable over a partial earlier apply.
drop function if exists public.admin_preview_tier_review();

create or replace function public.admin_preview_tier_review()
returns table (
  customer_id      uuid,
  name             text,
  phone            text,
  from_tier        text,
  to_tier          text,
  visits_in_window integer,
  last_visit_at    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window  integer;
  v_vip_min integer;
  v_reg_min integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select tier_window_months, tier_vip_min_visits, tier_regular_min_visits
    into v_window, v_vip_min, v_reg_min
    from public.app_settings where id = true;
  v_window  := coalesce(v_window, 6);
  v_vip_min := coalesce(v_vip_min, 5);
  v_reg_min := coalesce(v_reg_min, 3);

  return query
  with counts as (
    select c.id, c.name, c.phone, c.tier as current_tier, c.last_visit_at,
           coalesce(c.lifetime_points, 0) as lifetime,
           count(*) filter (
             where ck.id is not null
               and ck.status <> 'cancelled'
               and ck.created_at >= now() - make_interval(months => v_window)
           ) as n
    from public.customer c
    left join public.checkin ck on ck.customer_id = c.id
    where not coalesce(c.tier_locked, false)
    group by c.id
  )
  select counts.id, counts.name, counts.phone, counts.current_tier,
         public.next_tier(counts.current_tier, counts.n::integer, counts.lifetime, v_vip_min, v_reg_min),
         counts.n::integer,
         counts.last_visit_at
  from counts
  where counts.current_tier
        <> public.next_tier(counts.current_tier, counts.n::integer, counts.lifetime, v_vip_min, v_reg_min)
  order by counts.name;
end;
$$;

grant execute on function public.admin_preview_tier_review() to authenticated;

-- Apply the review to ONLY the given customer ids (the admin's selection).
-- Recomputes next_tier per id from live data (so it matches the preview), logs
-- each move as 'review'. Returns how many actually changed.
create or replace function public.admin_apply_tier_review(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window  integer;
  v_vip_min integer;
  v_reg_min integer;
  v_changed integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  select tier_window_months, tier_vip_min_visits, tier_regular_min_visits
    into v_window, v_vip_min, v_reg_min
    from public.app_settings where id = true;
  v_window  := coalesce(v_window, 6);
  v_vip_min := coalesce(v_vip_min, 5);
  v_reg_min := coalesce(v_reg_min, 3);

  with counts as (
    select c.id, c.tier as current_tier, coalesce(c.lifetime_points, 0) as lifetime,
           count(*) filter (
             where ck.id is not null
               and ck.status <> 'cancelled'
               and ck.created_at >= now() - make_interval(months => v_window)
           ) as n
    from public.customer c
    left join public.checkin ck on ck.customer_id = c.id
    where c.id = any(p_ids) and not coalesce(c.tier_locked, false)
    group by c.id
  ),
  updated as (
    update public.customer cust
      set tier = public.next_tier(counts.current_tier, counts.n::integer,
                                  counts.lifetime, v_vip_min, v_reg_min)
      from counts
      where counts.id = cust.id
        and cust.tier <> public.next_tier(counts.current_tier, counts.n::integer,
                                          counts.lifetime, v_vip_min, v_reg_min)
      returning cust.id as customer_id, counts.current_tier as from_tier,
                cust.tier as to_tier, counts.n as n
  ),
  logged as (
    insert into public.tier_change (customer_id, from_tier, to_tier, source, visits_in_window)
    select customer_id, from_tier, to_tier, 'review', n from updated
    returning 1
  )
  select count(*) into v_changed from logged;
  return v_changed;
end;
$$;

grant execute on function public.admin_apply_tier_review(uuid[]) to authenticated;

-- 12. Monthly cron job -------------------------------------------------------
-- Runs the pure-SQL review on the 1st of each month at 10:00 UTC. Unschedule
-- first so a re-run doesn't stack duplicates (the 0004 pattern).
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('monthly-tier-review');
exception when others then null;
end $$;

select cron.schedule('monthly-tier-review', '0 10 1 * *', $$select public.run_tier_review()$$);
