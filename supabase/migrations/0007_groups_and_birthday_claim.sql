-- Galaxy Check-In — service groups + birthday benefit tracking.
-- Adds:
--   * service_group table (name, active) and service.group_id
--     (existing distinct `category` values are migrated into groups + linked;
--      `category` is kept as a denormalized fallback label for now).
--   * customer.birthday_redeemed_year — the year the birthday discount was last
--     claimed. The birthday warning hides once claimed for the current year.
--   * claim_birthday(customer_id) RPC — marks the birthday benefit used this year.

-- ---------------------------------------------------------------------------
-- service_group
-- ---------------------------------------------------------------------------
create table if not exists public.service_group (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  active boolean not null default true
);

alter table public.service add column if not exists group_id uuid
  references public.service_group (id) on delete set null;

alter table public.service_group enable row level security;

-- Kiosk (anon) reads active groups; admins manage.
create policy "anon reads active service groups" on public.service_group
  for select to anon using (active = true);

create policy "admin manages service_group" on public.service_group
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed groups from existing distinct service categories, then link services.
insert into public.service_group (name)
  select distinct category from public.service
  where category is not null and category <> ''
  on conflict do nothing;

update public.service s
  set group_id = g.id
  from public.service_group g
  where s.group_id is null and s.category = g.name;

-- ---------------------------------------------------------------------------
-- Birthday benefit: track the year last claimed.
-- ---------------------------------------------------------------------------
alter table public.customer add column if not exists birthday_redeemed_year integer;

-- Mark the birthday discount as used for the current year. SECURITY DEFINER so
-- the anon kiosk can call it (self-serve claim); admins can call it too.
create or replace function public.claim_birthday(p_customer_id uuid)
returns integer -- the year now recorded as claimed
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
begin
  update public.customer
    set birthday_redeemed_year = v_year
    where id = p_customer_id;
  if not found then
    raise exception 'customer not found';
  end if;

  -- Record it in the loyalty ledger for history (0 points; it's a discount perk).
  insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
  values (p_customer_id, null, 0, 'Birthday discount claimed');

  return v_year;
end;
$$;

grant execute on function public.claim_birthday(uuid) to anon, authenticated;
