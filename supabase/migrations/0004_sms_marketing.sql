-- Galaxy Check-In — SMS templates, marketing campaigns, and birthday auto-SMS.
--
-- Builds on the existing `notification` table + send-notification Edge Function
-- (ClickSend). Adds:
--   * sms_template     — reusable, admin-authored SMS bodies with {{name}} etc.
--   * notification.kind / template_id — classify + trace each sent message
--   * customer.birthday_sms_year      — once-per-year guard for auto birthday SMS
--   * a daily pg_cron job that invokes send-birthday-sms
--
-- Marketing sends go ONLY to customers with marketing_consent = true — enforced
-- in the query hooks and re-checked server-side by the campaign path.

-- 1. Message classification -------------------------------------------------
do $$ begin
  create type notification_kind as enum ('checkin', 'marketing', 'birthday');
exception when duplicate_object then null; end $$;

alter table public.notification
  add column if not exists kind        notification_kind not null default 'checkin',
  add column if not exists template_id uuid;

-- 2. sms_template -----------------------------------------------------------
-- Body supports {{name}} (customer name) and {{reward}} (active birthday program
-- reward, for birthday templates). Rendering happens in the Edge Function.
create table if not exists public.sms_template (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  body        text not null,
  -- 'marketing' templates appear in the campaign picker; 'birthday' is the one
  -- used by the daily auto-send. Kept simple: a plain text tag.
  kind        notification_kind not null default 'marketing',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_sms_template_kind on public.sms_template (kind);

-- notification.template_id references sms_template (nullable: check-in messages
-- and ad-hoc sends have no template). Set null on template delete so history
-- survives.
alter table public.notification
  drop constraint if exists notification_template_id_fkey;
alter table public.notification
  add constraint notification_template_id_fkey
  foreign key (template_id) references public.sms_template (id) on delete set null;

-- 3. Birthday auto-SMS dedup guard -----------------------------------------
-- Separate from birthday_redeemed_year (reward claims): this tracks the year we
-- last *texted* a birthday greeting, so the daily job never double-sends.
alter table public.customer
  add column if not exists birthday_sms_year integer;

-- 4. RLS --------------------------------------------------------------------
alter table public.sms_template enable row level security;

drop policy if exists "admin manages sms templates" on public.sms_template;
create policy "admin manages sms templates" on public.sms_template
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Admins may INSERT notifications (campaign sends done client-side fall back to
-- this; the Edge Function uses the service role and bypasses RLS). Reads already
-- exist ("admin reads notifications").
drop policy if exists "admin inserts notifications" on public.notification;
create policy "admin inserts notifications" on public.notification
  for insert to authenticated with check (public.is_admin());

-- 5. Seed a default birthday template ---------------------------------------
insert into public.sms_template (name, body, kind)
select 'Birthday greeting',
       'Happy birthday {{name}}! 🎂 Enjoy {{reward}} on your next visit to Galaxy Nails.',
       'birthday'
where not exists (select 1 from public.sms_template where kind = 'birthday');

-- 6. Daily birthday-SMS cron job --------------------------------------------
-- Requires pg_cron + pg_net (standard on Supabase). The job POSTs to the
-- send-birthday-sms Edge Function once a day; that function finds today's
-- birthdays (consented, not yet texted this year) and sends them.
--
-- The function URL + service-role key are read from app settings you set once:
--   select set_config('app.settings.edge_url', 'https://<ref>.functions.supabase.co', false);
-- Simpler: we store them in a tiny config table so the job body stays static.
create table if not exists public.app_secret (
  key   text primary key,
  value text not null
);
alter table public.app_secret enable row level security;
-- No policies => only the service role (and SECURITY DEFINER fns) can read it.
-- Admins never need these secrets in the browser.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper: invoke the birthday function using the stored URL + key. SECURITY
-- DEFINER so it can read app_secret. Safe no-op if the config isn't set yet.
create or replace function public.run_birthday_sms()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_key  text;
begin
  select value into v_base from public.app_secret where key = 'edge_url';
  select value into v_key  from public.app_secret where key = 'service_role_key';
  if v_base is null or v_key is null then
    raise notice 'run_birthday_sms: app_secret edge_url/service_role_key not set; skipping';
    return;
  end if;

  perform net.http_post(
    url     := v_base || '/send-birthday-sms',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := '{}'::jsonb
  );
end;
$$;

-- (Re)schedule the daily job at 09:00 UTC. Unschedule first so re-running this
-- migration doesn't stack duplicates.
do $$
begin
  perform cron.unschedule('daily-birthday-sms');
exception when others then null;
end $$;

select cron.schedule('daily-birthday-sms', '0 9 * * *', $$select public.run_birthday_sms()$$);
