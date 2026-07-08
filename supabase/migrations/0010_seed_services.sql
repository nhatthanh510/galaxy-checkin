-- Seed service groups + services from the salon menu ------------------------
-- Transcribed from the GoCheckin service screens. Prices and durations are left
-- at 0 (schema defaults) — fill them in via the admin Services page.
--
-- Idempotent: groups are inserted only when the name doesn't already exist, and
-- each service only when a same-named service in that group is absent. Safe to
-- re-run / re-apply. `category` mirrors the group name (denormalized label).

do $$
declare
  v_group_id uuid;
  v_group    text;
  v_service  text;
  -- Ordered list of (group, service). Groups appear in menu order.
  v_menu text[][] := array[
    -- ACRYLIC
    array['ACRYLIC', 'Acrylic fullset (with tips)'],
    array['ACRYLIC', 'Acrylic removal + Acrylic fullset'],
    array['ACRYLIC', 'SNS removal + Acrylic fullset'],
    array['ACRYLIC', 'Shellac removal + Acrylic fullset'],
    array['ACRYLIC', 'Acrylic fullset French'],
    array['ACRYLIC', 'Acrylic fullset ombre'],
    array['ACRYLIC', 'Acrylic overlay (no tips)'],
    array['ACRYLIC', 'Acrylic refill'],
    array['ACRYLIC', 'Acrylic refill French'],
    array['ACRYLIC', 'Acrylic removal'],
    array['ACRYLIC', 'extra for each fixed finger'],
    -- MANICURE
    array['MANICURE', 'Manicure shellac'],
    array['MANICURE', 'Manicure normal'],
    array['MANICURE', 'Manicure no color'],
    array['MANICURE', 'Shellac removal'],
    array['MANICURE', 'extra for French'],
    array['MANICURE', 'extra for each fixed finger'],
    -- SNS (Dipping powder)
    array['SNS (Dipping powder)', 'SNS fullset (with tips)'],
    array['SNS (Dipping powder)', 'SNS overlay (no tips)'],
    array['SNS (Dipping powder)', 'SNS removal + SNS fullset'],
    array['SNS (Dipping powder)', 'SNS removal + SNS overlay'],
    array['SNS (Dipping powder)', 'SNS fullset French'],
    array['SNS (Dipping powder)', 'SNS overlay French'],
    array['SNS (Dipping powder)', 'SNS fullset ombre'],
    array['SNS (Dipping powder)', 'SNS removal'],
    array['SNS (Dipping powder)', 'extra for more than 2 colors'],
    array['SNS (Dipping powder)', 'extra for French'],
    -- COLORS (buff, shape)
    array['COLORS (buff, shape)', 'Shellac'],
    array['COLORS (buff, shape)', 'Normal'],
    array['COLORS (buff, shape)', 'extra for shellac removal'],
    -- Spa pedicure
    array['Spa pedicure', 'Spa pedicure shellac'],
    array['Spa pedicure', 'Spa pedicure normal'],
    array['Spa pedicure', 'Shellac removal'],
    array['Spa pedicure', 'extra for French'],
    -- DESIGN
    array['DESIGN', 'Design (per finger)'],
    array['DESIGN', 'Design fullset'],
    array['DESIGN', 'Shellac removal'],
    array['DESIGN', 'extra for French'],
    -- BUILDER GEL
    array['BUILDER GEL', 'BUILDER GEL ON NATURAL NAILS'],
    array['BUILDER GEL', 'BUILDER GEL REFILL'],
    array['BUILDER GEL', 'BUILDER GEL FULLSET (With tips)']
  ];
  i int;
begin
  for i in 1 .. array_length(v_menu, 1) loop
    v_group   := v_menu[i][1];
    v_service := v_menu[i][2];

    -- Ensure the group exists; capture its id.
    select id into v_group_id from public.service_group where name = v_group;
    if v_group_id is null then
      insert into public.service_group (name) values (v_group)
      returning id into v_group_id;
    end if;

    -- Insert the service if a same-named one in this group doesn't exist.
    if not exists (
      select 1 from public.service
      where name = v_service and group_id = v_group_id
    ) then
      insert into public.service (name, category, group_id)
      values (v_service, v_group, v_group_id);
    end if;
  end loop;
end $$;
