-- Fix: "column reference customer_id is ambiguous" in create_checkin ----------
-- create_checkin declares customer_id as an OUT column (returns table), so the
-- once-per-day guard's unqualified `where customer_id = v_customer.id` was
-- ambiguous between that OUT column and public.checkin.customer_id — the RPC
-- errored on every check-in. Qualify the column with a table alias.
--
-- Same 8-arg signature as 0013, so create-or-replace (no drop/re-grant needed).
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
           v_customer.points_balance, v_customer.visit_count;
end;
$$;
