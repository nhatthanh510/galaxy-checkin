-- create_checkin: make the +1 point optional -------------------------------
-- The kiosk now shows the reward step BEFORE check-in. If a customer redeems a
-- points reward there, this visit must not also earn its +1 point (a point
-- rewards a previously-paid visit). The kiosk passes p_award_point = false in
-- that case; every other path (no redeem, birthday claim, admin) leaves the
-- default true, so behaviour is unchanged.
--
-- Only the earn is gated: the customer row is still created/updated, the checkin
-- is still recorded, and services still link. When the point is skipped, no
-- 'Earned at check-in' loyalty_transaction is written either.
--
-- Adding p_award_point changes the function signature, so drop the old 6-arg
-- version first (otherwise we'd create a second overload and PostgREST could
-- resolve to either). Re-grant afterwards.
drop function if exists public.create_checkin(text, text, uuid[], uuid, date, boolean);

create or replace function public.create_checkin(
  p_phone         text,
  p_name          text,
  p_service_ids   uuid[] default '{}',
  p_technician_id uuid   default null,
  p_birthday      date   default null,
  p_consent       boolean default false,
  p_award_point   boolean default true
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
  -- 0 points when the visit's point is intentionally skipped (redeemed a points
  -- reward this visit).
  v_points integer := case when p_award_point then 1 else 0 end;
begin
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone is required';
  end if;

  select * into v_customer from public.customer where phone = p_phone for update;
  if v_customer.id is null then
    insert into public.customer
      (phone, name, visit_count, points_balance, birthday, marketing_consent)
    values
      (p_phone, coalesce(nullif(trim(p_name), ''), 'Guest'), 1, v_points,
       p_birthday, p_consent)
    returning * into v_customer;
  else
    update public.customer
      set visit_count       = customer.visit_count + 1,
          points_balance    = customer.points_balance + v_points,
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

  -- Only log an earn when a point was actually awarded.
  if v_points > 0 then
    insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
    values (v_customer.id, v_checkin_id, v_points, 'Earned at check-in');
  end if;

  return query
    select v_checkin_id, v_customer.id, v_customer.name,
           v_customer.points_balance, v_customer.visit_count;
end;
$$;

-- Re-grant for the new signature (kiosk is anon-or-authenticated; 0002 keeps it
-- to authenticated only, which this preserves — grant to authenticated).
grant execute on function
  public.create_checkin(text, text, uuid[], uuid, date, boolean, boolean)
  to authenticated;
