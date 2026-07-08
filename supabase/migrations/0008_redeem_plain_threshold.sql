-- Redeem: plain threshold, no same-day clawback -----------------------------
-- Supersedes 0007. The business team found the same-day "clawback" confusing
-- ("need 11 points to redeem a 10-point reward"). The agreed model is simpler:
-- redeem_points just requires balance >= threshold and subtracts exactly the
-- threshold. The "not redeemable on the earning visit" intent is handled by the
-- UI thresholds instead (kiosk redeems at >= N because reaching the kiosk redeem
-- screen is itself a later check-in; admin redeems only at > N).
--
-- This also RESTORES the non-points (date_window / always) branch that 0007
-- accidentally dropped — 0007 only handled the points branch, so birthday and
-- standing-promo redemptions through redeem_points would have misbehaved. The
-- body below matches the 0003 dispatch behaviour.
--
-- create_checkin is intentionally NOT changed: it still awards +1 at check-in.

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
    -- Non-points rewards ('date_window' and 'always'): no points cost, capped at
    -- once per calendar year. For 'date_window' the in-window check is enforced
    -- client-side against date_anchor; the server owns the once-per-year invariant.
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
