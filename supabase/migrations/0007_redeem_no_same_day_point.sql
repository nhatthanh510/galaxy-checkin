-- Redeem must not leave the same-day check-in point on the balance -----------
-- Business rule: the visit on which a customer redeems should not also earn its
-- +1 check-in point. Because check-in (+1) happens before staff redeems, that
-- point is already banked — so a redemption on a visit day must also remove it.
--
-- This replaces redeem_points to, in addition to subtracting the program's
-- threshold, claw back ONE point IF the customer checked in today AND that
-- day's earned point hasn't already been clawed back (idempotent — redeeming
-- twice in a day only removes the single same-day point once). If the customer
-- did NOT check in today, only the threshold is subtracted (honest redemptions
-- on a non-visit day are never over-charged).

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
  v_checked_in_today boolean;
  v_already_clawed   boolean;
  v_clawback integer := 0;
  v_total    integer;
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

  -- Did this customer check in today (local server date)?
  select exists (
    select 1 from public.checkin
    where customer_id = p_customer_id
      and created_at::date = now()::date
  ) into v_checked_in_today;

  -- Have we already clawed back today's check-in point in a prior redeem today?
  select exists (
    select 1 from public.loyalty_transaction
    where customer_id = p_customer_id
      and reason = 'Same-day check-in point (not earned on redeem visit)'
      and created_at::date = now()::date
  ) into v_already_clawed;

  if v_checked_in_today and not v_already_clawed then
    v_clawback := 1;
  end if;

  v_total := v_program.points_per_reward + v_clawback;

  if v_customer.points_balance < v_total then
    raise exception 'not enough points to redeem (have %, need %)',
      v_customer.points_balance, v_total;
  end if;

  update public.customer
    set points_balance = customer.points_balance - v_total
    where id = p_customer_id
    returning * into v_customer;

  insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
  values (p_customer_id, null, -v_program.points_per_reward, 'Redeemed: ' || v_program.name);

  -- Record the clawback separately so the ledger explains the extra -1.
  if v_clawback > 0 then
    insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
    values (p_customer_id, null, -v_clawback,
            'Same-day check-in point (not earned on redeem visit)');
  end if;

  return query
    select v_customer.points_balance, v_program.points_per_reward,
           v_program.reward_type, v_program.reward_value;
end;
$$;
