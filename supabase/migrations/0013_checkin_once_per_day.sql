-- One check-in per customer per day -----------------------------------------
-- Product rule: a customer may only join the waitlist once per calendar day.
-- Enforced server-side in create_checkin so it holds no matter which client
-- calls it (the kiosk is the only caller today, but this is the source of truth).
--
-- The "day" boundary is supplied by the CLIENT (p_day_start = start of the
-- kiosk's LOCAL day, as a UTC instant). The kiosk tablet's clock is set to the
-- salon's timezone, so its local midnight is the correct boundary — and no
-- timezone is hardcoded here. The DB just compares created_at (a UTC instant)
-- against p_day_start (also a UTC instant). When p_day_start is null the guard
-- is skipped, so any non-kiosk caller isn't forced to supply it.
--
-- Recreate create_checkin adding p_day_start + the guard, right after the
-- customer row is located/locked and before any visit_count or points mutation,
-- so a duplicate visit changes nothing. Drop-then-create to avoid a stale
-- overload; re-grant to authenticated (kiosk requires login since 0002).
drop function if exists
  public.create_checkin(text, text, uuid[], uuid, date, boolean, boolean);

create or replace function public.create_checkin(
  p_phone         text,
  p_name          text,
  p_service_ids   uuid[]      default '{}',
  p_technician_id uuid        default null,
  p_birthday      date        default null,
  p_consent       boolean     default false,
  p_award_point   boolean     default true,
  p_day_start     timestamptz default null
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
  -- reward this visit). Applied to BOTH points_balance and lifetime_points.
  v_points integer := case when p_award_point then 1 else 0 end;
begin
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone is required';
  end if;

  select * into v_customer from public.customer where phone = p_phone for update;

  -- One check-in per client-local day. Only existing customers can have a prior
  -- visit today; a brand-new customer always falls through to the insert below.
  if v_customer.id is not null and p_day_start is not null and exists (
    select 1 from public.checkin
    where customer_id = v_customer.id
      and created_at >= p_day_start
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

grant execute on function
  public.create_checkin(text, text, uuid[], uuid, date, boolean, boolean, timestamptz)
  to authenticated;

-- Supports the once-per-day existence check (and per-customer history reads).
create index if not exists idx_checkin_customer_created_at
  on public.checkin (customer_id, created_at);

-- Kiosk pre-flight: has this customer checked in since the start of their local
-- day? The kiosk calls this right after phone lookup so a returning customer
-- who's already visited is stopped at the phone screen — before the reward step,
-- where redeeming points would otherwise spend them on a visit create_checkin
-- then rejects. p_day_start is the client's local midnight (see above).
-- SECURITY DEFINER (anon has no blanket read on checkin); takes only a customer
-- id + the day boundary, mirroring the other kiosk self-serve RPCs.
create or replace function public.customer_checked_in_today(
  p_customer_id uuid,
  p_day_start   timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.checkin
    where customer_id = p_customer_id
      and created_at >= p_day_start
  );
$$;

grant execute on function
  public.customer_checked_in_today(uuid, timestamptz)
  to authenticated;
