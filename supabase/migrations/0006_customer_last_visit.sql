-- Last-visit tracking + customer import RPC ---------------------------------
-- Adds customer.last_visit_at (the timestamp of the customer's most recent
-- visit) so the admin list can sort by recency, and an admin-only RPC that
-- imports customers together with a synthetic "completed" checkin dated to the
-- imported Last Visited value — so legacy visits show up in Visit History.

-- 1. Denormalized last-visit timestamp --------------------------------------
alter table public.customer
  add column if not exists last_visit_at timestamptz;

-- Backfill from existing checkins (max created_at per customer).
update public.customer c
  set last_visit_at = sub.mx
  from (
    select customer_id, max(created_at) as mx
    from public.checkin group by customer_id
  ) sub
  where sub.customer_id = c.id and c.last_visit_at is null;

create index if not exists idx_customer_last_visit_at
  on public.customer (last_visit_at desc nulls last);

-- 2. Keep last_visit_at fresh on live check-ins ------------------------------
-- create_checkin inserts a checkin then returns; stamp the customer's
-- last_visit_at at insert time via a trigger so every code path stays correct.
create or replace function public.touch_customer_last_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customer
    set last_visit_at = greatest(coalesce(last_visit_at, new.created_at), new.created_at)
    where id = new.customer_id;
  return new;
end;
$$;

drop trigger if exists trg_checkin_touch_last_visit on public.checkin;
create trigger trg_checkin_touch_last_visit
  after insert on public.checkin
  for each row execute function public.touch_customer_last_visit();

-- 3. Admin import RPC --------------------------------------------------------
-- Upserts a batch of customers by phone and, when a row carries a last_visited
-- timestamp, records ONE synthetic completed checkin at that time (the XLSX only
-- has the most-recent visit, not full history). Runs as the caller's admin
-- session; guarded by is_admin() so anon can't invoke it.
--
-- Input: a JSON array of objects with keys
--   phone, name, points_balance, visit_count, lifetime_points,
--   birthday (date or null), marketing_consent (bool), last_visited (timestamptz or null)
create or replace function public.import_customers(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row        jsonb;
  v_customer_id uuid;
  v_last       timestamptz;
  v_count      integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_last := nullif(v_row->>'last_visited', '')::timestamptz;

    insert into public.customer as c
      (phone, name, points_balance, visit_count, lifetime_points,
       birthday, marketing_consent, last_visit_at)
    values (
      v_row->>'phone',
      v_row->>'name',
      coalesce((v_row->>'points_balance')::integer, 0),
      coalesce((v_row->>'visit_count')::integer, 0),
      coalesce((v_row->>'lifetime_points')::integer, 0),
      nullif(v_row->>'birthday', '')::date,
      coalesce((v_row->>'marketing_consent')::boolean, false),
      v_last
    )
    on conflict (phone) do update set
      name              = excluded.name,
      points_balance    = excluded.points_balance,
      visit_count       = excluded.visit_count,
      lifetime_points   = excluded.lifetime_points,
      -- Don't blank an existing birthday/consent if the import omitted it.
      birthday          = coalesce(excluded.birthday, c.birthday),
      marketing_consent = excluded.marketing_consent,
      last_visit_at     = greatest(c.last_visit_at, excluded.last_visit_at)
    returning c.id into v_customer_id;

    -- One synthetic completed visit at the imported timestamp, if provided and
    -- the customer doesn't already have a checkin at that instant (idempotent
    -- re-import guard). The trigger above keeps last_visit_at in sync too.
    if v_last is not null then
      insert into public.checkin (customer_id, status, created_at)
      select v_customer_id, 'completed', v_last
      where not exists (
        select 1 from public.checkin
        where customer_id = v_customer_id and created_at = v_last
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.import_customers(jsonb) from public, anon;
grant execute on function public.import_customers(jsonb) to authenticated;
