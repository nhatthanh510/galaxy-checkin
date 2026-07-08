-- Admin can edit lifetime_points ---------------------------------------------
-- admin_update_customer gains p_lifetime_points so staff can correct a
-- customer's lifetime total (e.g. after an import). Lifetime points is a
-- historical figure, so changing it does NOT write a loyalty_transaction (only
-- points_balance changes do — that ledger tracks balance movements).
--
-- Adding a parameter changes the signature, so drop the old 4-arg function first
-- (otherwise a second overload is created), then recreate and re-grant.
drop function if exists public.admin_update_customer(uuid, text, integer, date);

create or replace function public.admin_update_customer(
  p_customer_id     uuid,
  p_name            text,
  p_points_balance  integer,
  p_birthday        date default null,
  p_lifetime_points integer default null
)
returns public.customer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customer;
  v_delta    integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_customer from public.customer where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'customer not found';
  end if;

  v_delta := p_points_balance - v_customer.points_balance;

  update public.customer
    set name            = p_name,
        points_balance  = p_points_balance,
        birthday        = p_birthday,
        -- Only overwrite lifetime_points when a value is supplied; null leaves it.
        lifetime_points = coalesce(p_lifetime_points, customer.lifetime_points)
    where id = p_customer_id
    returning * into v_customer;

  -- Ledger only reflects points_balance movements, not lifetime edits.
  if v_delta <> 0 then
    insert into public.loyalty_transaction (customer_id, checkin_id, amount, reason)
    values (p_customer_id, null, v_delta, 'Admin adjustment');
  end if;

  return v_customer;
end;
$$;

grant execute on function
  public.admin_update_customer(uuid, text, integer, date, integer)
  to authenticated;
