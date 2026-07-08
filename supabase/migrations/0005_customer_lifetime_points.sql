-- Customer import: lifetime points -----------------------------------------
-- Legacy systems (and our XLSX import) track a "Life Time Point" — the total
-- points a customer has earned over their history, before redemptions. This is
-- distinct from points_balance (current redeemable) and visit_count.
--
-- birthday (date) and marketing_consent (boolean) already exist (0001_init.sql),
-- so the import can populate those without a schema change; only lifetime_points
-- is new.

alter table public.customer
  add column if not exists lifetime_points integer not null default 0;

-- No RLS change needed: customer already has row-level security and the column
-- is covered by the existing admin-manages-customer policies (0001/0002).
