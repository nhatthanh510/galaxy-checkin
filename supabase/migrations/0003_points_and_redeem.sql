-- Galaxy Check-In — loyalty points earning + redemption.
-- Builds on 0002. Changes:
--   * create_checkin now awards +1 point per check-in and logs an "earned"
--     loyalty_transaction (new customers get 1 point on their first check-in).
--   * new redeem_points RPC: subtracts the active program's threshold from the
--     balance (keeping any surplus) and logs a "redeemed" transaction.
-- Loyalty program CRUD needs no new grants — the "admin manages loyalty_program"
-- policy from 0002 already gives admins full insert/update/delete/select.

-- ===========================================================================
-- Redefine create_checkin to award 1 point per check-in.
-- Returns the same shape as before (callers unchanged).
-- ===========================================================================
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
  v_points_per_checkin integer := 1; -- one point per visit
begin
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone is required';
  end if;

  -- Upsert customer by phone. New customers get 1 point on their first check-in;
  -- returning customers get +1 and a bumped visit count.
  select * into v_customer from public.customer where phone = p_phone;
  if v_customer.id is null then
    insert into public.customer (phone, name, visit_count, points_balance)
    values (p_phone, coalesce(nullif(trim(p_name), ''), 'Guest'), 1, v_points_per_checkin)
    returning * into v_customer;
  else
    -- Qualify source columns with the table name so they can't be read as the
    -- function's RETURNS TABLE output params of the same name (error 42702,
    -- "column reference is ambiguous").
    update public.customer
      set visit_count    = customer.visit_count + 1,
          points_balance = customer.points_balance + v_points_per_checkin
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

  -- Log the earned point.
  insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
  values (v_customer.id, v_checkin_id, v_points_per_checkin, 'Earned at check-in');

  return query
    select v_checkin_id, v_customer.id, v_customer.name,
           v_customer.points_balance, v_customer.visit_count;
end;
$$;

grant execute on function public.create_checkin(text, text, uuid[], uuid) to anon, authenticated;

-- ===========================================================================
-- redeem_points — subtract the active program's threshold from a customer's
-- balance (keeping the surplus) and log the redemption. Fails if the balance is
-- below the threshold. Returns the new balance + the amount redeemed.
-- ===========================================================================
create or replace function public.redeem_points(p_customer_id uuid)
returns table (
  points_balance  integer,
  redeemed_points integer,
  reward_amount   numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer  public.customer;
  v_threshold integer;
  v_reward    numeric;
begin
  select * into v_customer from public.customer where id = p_customer_id;
  if v_customer.id is null then
    raise exception 'customer not found';
  end if;

  -- Read the single active program's threshold + reward. Qualify reward_amount
  -- with the table name: it also names a RETURNS TABLE output param, so an
  -- unqualified reference is ambiguous (error 42702).
  select loyalty_program.points_per_reward, loyalty_program.reward_amount
    into v_threshold, v_reward
    from public.loyalty_program
    where active = true
    order by id
    limit 1;

  if v_threshold is null then
    raise exception 'no active loyalty program';
  end if;

  if v_customer.points_balance < v_threshold then
    raise exception 'not enough points to redeem (have %, need %)',
      v_customer.points_balance, v_threshold;
  end if;

  -- Subtract the threshold, keep any surplus. Qualify the source column so it is
  -- not read as the RETURNS TABLE output param of the same name (error 42702).
  update public.customer
    set points_balance = customer.points_balance - v_threshold
    where id = p_customer_id
    returning * into v_customer;

  insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
  values (p_customer_id, null, -v_threshold, 'Redeemed reward');

  return query select v_customer.points_balance, v_threshold, v_reward;
end;
$$;

-- Anon (kiosk self-serve) and authenticated (admin) may both redeem.
grant execute on function public.redeem_points(uuid) to anon, authenticated;
