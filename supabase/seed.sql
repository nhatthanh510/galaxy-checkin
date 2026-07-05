-- Seed data for local development. Mirrors the mock data in src/lib/mock/data.ts
-- so the kiosk behaves the same once the hooks are switched to Supabase.

-- Loyalty program: "10 Point — 10 points get $10 off".
insert into public.loyalty_program (name, description, points_per_reward, reward_amount, active)
values ('10 Point', '10 points get $10 off', 10, 10.00, true);

-- Services grouped by category.
insert into public.service (name, category, price, duration_minutes) values
  ('Regular Manicure',  'Manicure Fastboy', 20.00, 30),
  ('Gel Manicure',      'Manicure Fastboy', 35.00, 45),
  ('Regular Pedicure',  'Pedicure Fastboy', 30.00, 40),
  ('Deluxe Pedicure',   'Pedicure Fastboy', 45.00, 60),
  ('Full Set Acrylic',  'Nail Enhancements', 50.00, 75),
  ('Dip Powder',        'Nail Enhancements', 45.00, 60);

-- Technicians.
insert into public.technician (name, active, photo_url) values
  ('Anna',  true, null),
  ('Bao',   true, null),
  ('Christine', true, null),
  ('David', true, null),
  ('Emily', true, null);

-- A couple of known customers to exercise the known/redeem branches.
insert into public.customer (phone, name, visit_count, points_balance) values
  ('8329686600', 'Linh Nguyen', 12, 20), -- at/above threshold -> redeem reminder
  ('8325551234', 'Sam Carter',   3,  4); -- known, below threshold
