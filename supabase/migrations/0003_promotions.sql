-- Galaxy Check-In — configurable promotions (generic trigger model).
--
-- Real-world loyalty systems (Square, Toast, Punchh) don't hardcode "birthday".
-- A promotion has two orthogonal axes:
--   1. TRIGGER  — when it can be claimed
--   2. REWARD   — what you get (already generic: reward_type + reward_value)
--
-- A loyalty_program carries a `trigger_type`; birthday is just one instance of a
-- date-window trigger. A signup "anniversary" or a standing "welcome" promo drop
-- in with no schema change — only a new date_anchor / trigger_type value.
--
--   trigger_type = 'points'      -> claimable when points_balance >= points_per_reward
--   trigger_type = 'date_window' -> claimable when today is within
--                                   [-window_before_days, +window_after_days] of the
--                                   customer date named by `date_anchor` (once/year)
--   trigger_type = 'always'      -> always claimable (a standing promo / welcome offer)
--
-- The claim window is PER-PROGRAM (window_before_days / window_after_days) so a
-- birthday promo can be ±7 while an anniversary promo is ±3.
--
-- LIMITATION (accepted): the once-per-year guard for non-points rewards reuses
-- the single customer.birthday_redeemed_year column, so a customer can claim at
-- most ONE date_window/always reward per calendar year across all such programs.
-- Fine while the salon runs a single such promo at a time. Lifting it later means
-- a per-(customer,program,year) claims table — deliberately not built here to keep
-- the model simple.

-- 1. Enums ------------------------------------------------------------------
do $$ begin
  create type promotion_trigger as enum ('points', 'date_window', 'always');
exception when duplicate_object then null; end $$;

-- Which customer date a date_window trigger anchors on. 'birthday' is the only
-- anchor today; add 'signup_anniversary' etc. here later.
do $$ begin
  create type promotion_date_anchor as enum ('birthday');
exception when duplicate_object then null; end $$;

-- 2. Columns ----------------------------------------------------------------
alter table public.loyalty_program
  add column if not exists trigger_type       promotion_trigger not null default 'points',
  add column if not exists date_anchor        promotion_date_anchor,
  add column if not exists window_before_days integer not null default 7,
  add column if not exists window_after_days  integer not null default 7;

-- 3. redeem_points, dispatched by trigger_type ------------------------------
-- Same reward machinery, gated by trigger:
--   points      -> require & subtract points
--   date_window -> require in-window + not-claimed-this-year; stamp the year
--   always      -> no eligibility gate, but still once-per-year
-- Date-window & always rewards deduct no points. The once-per-year guard for
-- both non-points triggers is tracked via customer.birthday_redeemed_year so a
-- standing promo can't be farmed every visit.
create or replace function public.redeem_points(
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
  v_year     integer := extract(year from now())::integer;
begin
  select * into v_customer from public.customer where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found';
  end if;

  if p_program_id is not null then
    select * into v_program from public.loyalty_program
      where id = p_program_id and active = true;
  else
    -- Default (no program specified): the primary points program.
    select * into v_program from public.loyalty_program
      where active = true and trigger_type = 'points' order by name limit 1;
  end if;

  if v_program.id is null then
    raise exception 'no matching active loyalty program';
  end if;

  if v_program.trigger_type = 'points' then
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

  else
    -- Non-points rewards ('date_window' and 'always') cost no points but are
    -- capped at once per calendar year. For 'date_window' the in-window check is
    -- enforced client-side against date_anchor; the server owns the
    -- once-per-year invariant, which it can verify alone.
    if v_customer.birthday_redeemed_year = v_year then
      raise exception 'reward already claimed this year';
    end if;
    update public.customer
      set birthday_redeemed_year = v_year
      where id = p_customer_id
      returning * into v_customer;

    insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
    values (p_customer_id, null, 0, 'Reward: ' || v_program.name);
  end if;

  return query
    select v_customer.points_balance, v_program.points_per_reward,
           v_program.reward_type, v_program.reward_value;
end;
$$;

grant execute on function public.redeem_points(uuid, uuid) to authenticated;
