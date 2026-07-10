-- Birthday discount by loyalty tier -----------------------------------------
-- The birthday reward is no longer a single fixed percent. Instead the percent
-- off is chosen by the customer's tier (derived from lifetime_points):
--   New (0..4 lifetime points)   -> birthday_percent_new
--   Regular (5..19)              -> birthday_percent_regular
--   VIP (>= 20)                  -> birthday_percent_vip
--
-- These live on the single-row app_settings so admins can configure them (the
-- Loyalty settings page's date_window reward_value is now ignored for birthday
-- programs — the tier percent wins). Kiosk + send-birthday-sms both read these.
--
-- Tier thresholds themselves (New < 5, Regular 5..19, VIP >= 20) are derived in
-- code (src/lib/tier.ts); only the per-tier percents are configurable here.

alter table public.app_settings
  add column if not exists birthday_percent_new     integer not null default 10,
  add column if not exists birthday_percent_regular integer not null default 15,
  add column if not exists birthday_percent_vip     integer not null default 20;

-- Guardrails: percents are 0..100.
alter table public.app_settings
  drop constraint if exists app_settings_birthday_percent_range;
alter table public.app_settings
  add constraint app_settings_birthday_percent_range check (
    birthday_percent_new     between 0 and 100 and
    birthday_percent_regular between 0 and 100 and
    birthday_percent_vip     between 0 and 100
  );

-- create_checkin: also return lifetime_points --------------------------------
-- The kiosk now offers reward redemption on the SUCCESS screen (after check-in),
-- so it needs the customer's post-check-in lifetime points to pick the birthday
-- discount tier (New/Regular/VIP). Add lifetime_points to the returned row.
--
-- Adding an OUT column changes the function's return row type, which Postgres
-- won't allow via CREATE OR REPLACE ("cannot change return type of existing
-- function") — so DROP first, then recreate and re-grant. The 8-arg signature is
-- unchanged, so the drop targets it exactly.
drop function if exists public.create_checkin(
  text, text, uuid[], uuid, date, boolean, boolean, timestamptz
);

create function public.create_checkin(
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
  -- unambiguous against the function's OUT column of the same name.
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

-- Re-grant execute (DROP removed the prior grant). Matches 0013: authenticated
-- only — the kiosk runs as an authenticated staff session.
grant execute on function
  public.create_checkin(text, text, uuid[], uuid, date, boolean, boolean, timestamptz)
  to authenticated;
