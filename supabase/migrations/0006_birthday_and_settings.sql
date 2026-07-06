-- Galaxy Check-In — customer birthdays + a general app settings table.
-- Adds:
--   * customer.birthday (date, nullable)
--   * app_settings — single-row config (birthday "soon" window, in days)
--   * create_checkin gains an optional p_birthday param (sets birthday on new
--     customers, or fills it in if a returning customer didn't have one).

-- ---------------------------------------------------------------------------
-- customer.birthday
-- ---------------------------------------------------------------------------
alter table public.customer add column if not exists birthday date;

-- ---------------------------------------------------------------------------
-- app_settings — single row (id = true) holding app-wide config. A CHECK keeps
-- it to exactly one row so `select * ... limit 1` is always the config.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id                    boolean primary key default true,
  birthday_days_before  integer not null default 7,
  birthday_days_after   integer not null default 7,
  updated_at            timestamptz not null default now(),
  constraint app_settings_singleton check (id = true)
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

-- Anyone (incl. the anon kiosk) may read the settings; only admins may change.
create policy "anyone reads settings" on public.app_settings
  for select to anon, authenticated using (true);

create policy "admin updates settings" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- create_checkin — replace with a version that also accepts a birthday.
-- Drop the old 4-arg signature so there's no overload ambiguity.
-- ---------------------------------------------------------------------------
drop function if exists public.create_checkin(text, text, uuid[], uuid);

create or replace function public.create_checkin(
  p_phone         text,
  p_name          text,
  p_service_ids   uuid[] default '{}',
  p_technician_id uuid   default null,
  p_birthday      date   default null
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

  select * into v_customer from public.customer where phone = p_phone;
  if v_customer.id is null then
    insert into public.customer (phone, name, visit_count, points_balance, birthday)
    values (p_phone, coalesce(nullif(trim(p_name), ''), 'Guest'), 1, v_points_per_checkin, p_birthday)
    returning * into v_customer;
  else
    update public.customer
      set visit_count    = customer.visit_count + 1,
          points_balance = customer.points_balance + v_points_per_checkin,
          -- Fill birthday only if we were given one and none is stored yet.
          birthday       = coalesce(customer.birthday, p_birthday)
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

  insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
  values (v_customer.id, v_checkin_id, v_points_per_checkin, 'Earned at check-in');

  return query
    select v_checkin_id, v_customer.id, v_customer.name,
           v_customer.points_balance, v_customer.visit_count;
end;
$$;

grant execute on function public.create_checkin(text, text, uuid[], uuid, date)
  to anon, authenticated;
