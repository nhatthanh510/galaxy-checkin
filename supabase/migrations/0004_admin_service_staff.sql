-- Galaxy Check-In — tighten service/technician management to admins.
-- The 0001 policies granted any authenticated user full access; align them with
-- the admin-only model from 0002 (is_admin()). Kiosk anon read policies from
-- 0001 ("anon reads active ...") are unchanged, so the kiosk still works.

drop policy if exists "staff full access service" on public.service;
create policy "admin manages service" on public.service
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff full access technician" on public.technician;
create policy "admin manages technician" on public.technician
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
