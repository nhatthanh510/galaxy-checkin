-- Seed data for a fresh dev DB. Run after 0001_init.sql.
-- Idempotent-ish for dev: assumes an empty schema.

-- Loyalty programs (multiple active -> kiosk carousel). Mix of fixed + percent.
insert into public.loyalty_program
  (name, description, points_per_reward, reward_type, reward_value, reward_amount, active)
values
  ('10 Point',     '10 points get $10 off',   10, 'fixed',   10, 10, true),
  ('Big Spender',  '20 points get 20% off',   20, 'percent', 20,  0, true);

-- Service groups.
insert into public.service_group (name, active) values
  ('Manicure',         true),
  ('Pedicure',         true),
  ('Nail Enhancements', true);

-- Services, linked to their group (category kept in sync with the group name).
insert into public.service (name, category, group_id, price, duration_minutes)
select s.name, g.name, g.id, s.price, s.duration
from (values
  ('Regular Manicure', 'Manicure',          20.00, 30),
  ('Gel Manicure',     'Manicure',          35.00, 45),
  ('Regular Pedicure', 'Pedicure',          30.00, 40),
  ('Deluxe Pedicure',  'Pedicure',          45.00, 60),
  ('Full Set Acrylic', 'Nail Enhancements', 50.00, 75),
  ('Dip Powder',       'Nail Enhancements', 45.00, 60)
) as s(name, group_name, price, duration)
join public.service_group g on g.name = s.group_name;

-- Technicians.
insert into public.technician (name, active, photo_url) values
  ('Anna',      true, null),
  ('Bao',       true, null),
  ('Christine', true, null),
  ('David',     true, null),
  ('Emily',     true, null);

-- Sample customers (AU mobiles) exercising known/redeem/birthday branches.
--   0412345678 — 20 pts (>= threshold -> redeemable), birthday today-ish
--   0498765432 — few pts, no birthday
insert into public.customer (phone, name, visit_count, points_balance, birthday) values
  ('0412345678', 'Linh Nguyen', 12, 20, '1992-03-15'),
  ('0498765432', 'Sam Carter',   3,  4, null);
