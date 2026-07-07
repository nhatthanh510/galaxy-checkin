# Galaxy Check-In

A web-based customer check-in app for nail salons, similar to **GoCheckIn** (by
Fastboy). Customers check in at a front-desk tablet (kiosk mode) by entering their
phone number, pick services and a preferred technician, and join the waitlist. Staff
manage the queue and customers earn loyalty points and receive SMS notifications.

**Reference product**: GoCheckIn by Fastboy — the kiosk flow below mirrors it.
Walkthrough video: https://www.youtube.com/watch?v=izKcadhd-9s

## Tech Stack

- **Frontend**: React + TypeScript, built with Vite
- **Styling**: Tailwind CSS (kiosk-first: large touch targets, high contrast)
- **Backend / DB / Auth**: Supabase (Postgres, Auth, Realtime, Row Level Security)
- **SMS**: Twilio (via a Supabase Edge Function — never call Twilio from the browser)
- **State/Data**: TanStack Query for server state; Supabase Realtime for the live queue
- **Routing**: React Router

## Project Structure

```
src/
  routes/          # Page-level components (kiosk check-in flow, staff dashboard)
    kiosk/         # Customer-facing flow: phone entry -> services -> tech -> confirm
    staff/         # Staff-facing: login, live queue, customer/loyalty management
  components/      # Reusable UI (shared across routes)
  lib/
    supabase.ts    # Supabase client singleton
    queries/       # TanStack Query hooks wrapping Supabase calls
  types/           # Shared TypeScript types (mirror the DB schema)
supabase/
  migrations/      # SQL schema migrations (source of truth for the DB)
  functions/       # Edge Functions (e.g. send-sms)
```

## Core Domain Model

- **customer** — identified by phone number (primary lookup key). Has name, visit
  count, `points_balance` (current redeemable loyalty points).
- **service** — offerings grouped by category (e.g. category "Manicure Fastboy" →
  service "Regular Manicure"). Has name, category, price, duration.
- **technician** — staff who perform services; has name, active flag, optional photo
  (kiosk shows an avatar with the initial when no photo).
- **checkin** — one visit. Links a customer to selected services and (optionally) a
  requested technician. Has a status: `waiting` → `in_service` → `completed` (or
  `cancelled`). This drives the queue.
- **loyalty_program** — the salon's earn/redeem rule (e.g. "10 points get $10 off").
  Single active config; shown on the phone-entry screen.
- **loyalty_transaction** — points earned/redeemed per checkin (signed amount + reason).

### Loyalty rules

- The **program info card** ("10 Point — 10 points get $10 off") is always visible on
  the phone-entry screen, next to the keypad.
- After a known customer enters their phone, if their `points_balance` meets the
  redemption threshold, **remind them they can redeem** (e.g. a banner: "You have 20
  points — redeem for $20 off!"). New/unknown numbers just see the generic program card.
- Points are awarded when a checkin is marked `completed`, written as a
  `loyalty_transaction` and reflected in `points_balance`.

## Key Flows

### Kiosk check-in flow (mirrors GoCheckIn)

Each step is its own route/screen. Dark theme, large touch targets, big NEXT button.

1. **Phone entry** — heading "PLEASE ENTER YOUR PHONE NUMBER", on-screen numeric
   keypad (1–9, 0, `delete`), the entered number shown formatted `(832) 968-66…`.
   - Left of the keypad: the **loyalty program info card** ("10 Point — 10 points get
     $10 off"), always visible.
   - Bottom: consent checkbox + Terms/Privacy text ("By checking this box and clicking
     NEXT, you give … consent to contact you … Consent is not required to check in").
   - On NEXT: look up the customer by phone.
     - **Known** → greet by name; if `points_balance` ≥ redeem threshold, show the
       "you can redeem" reminder. Skip to step 3.
     - **Unknown** → go to step 2 to capture the name.
2. **Name entry** (new customers only) — "Enter name" / "Please enter your full name",
   text field, NEXT.
3. **Service selection** — "What services do you want to choose?" Category header
   (e.g. "Manicure Fastboy") with checkbox list of services (e.g. "Regular Manicure").
   Buttons: **SKIP** or **NEXT** (services are optional).
4. **Technician selection** — "Please choose your preferred staff, but if you walk in
   you might have to wait…". Grid of technician avatars (initial in a purple circle +
   name). Buttons: **SKIP** or **NEXT** (tech is optional).
5. **Success** — green check, "You have checked in successfully!", and the customer's
   points ("You had X points"). Auto-returns to the phone-entry screen after a few
   seconds so the kiosk is ready for the next person.

On success, create the `checkin` with status `waiting` (creating the customer first if
new), and fire the confirmation SMS.

### Other flows

- **Queue (staff)**: live list of `waiting`/`in_service` checkins via Supabase
  Realtime. Staff assign a tech, move to `in_service`, then `completed`.
- **Loyalty**: award points on `completed` checkin; balance shown at check-in and on
  the success screen.
- **SMS**: send confirmation on check-in and a "your turn / table ready" notification,
  triggered server-side via the `send-sms` Edge Function.

## Conventions

- **TypeScript strict**; no `any`. Derive types from the DB schema where possible.
- **Supabase is the source of truth**: all schema changes go through a migration in
  `supabase/migrations/`. Do not edit tables only in the dashboard.
- **Row Level Security is required** on every table before it ships. Kiosk uses a
  limited anon/public path; staff routes require an authenticated session.
  - **Intentional exception — anon self-serve RPCs are unauthenticated.** The kiosk
    `redeem_points(customer_id, program_id)` and `claim_birthday(customer_id)` RPCs are
    `SECURITY DEFINER`, granted to `anon`, and take only a customer id — no phone/session
    check (see `0012_drop_phone_check.sql`). This means anyone with the public anon key can
    redeem/claim for any customer by UUID. It's an **accepted product tradeoff** (low blast
    radius: lost loyalty points, not money or data) chosen for kiosk simplicity — do NOT
    "fix" it as a security bug. To lock it down later, re-add a phone/ownership check
    (the `0011` migration is the template) or move redemption behind an authenticated path.
- **Secrets** (ClickSend username/API key, service-role key) live only in Edge Function
  env vars and `.env` (gitignored) — never in client code or committed files.
- **Data access** goes through hooks in `src/lib/queries/`, not inline Supabase calls
  in components.
- Prefer small, focused components; keep the kiosk flow’s steps as separate route
  components.

## Commands

This project uses **yarn** (not npm). `.yarnrc` sets `--ignore-engines` because a
transitive dev dep declares an overly narrow Node range; installs work with plain
`yarn install`.

- `yarn` / `yarn install` — install dependencies
- `yarn dev` — start the Vite dev server
- `yarn build` — production build
- `yarn lint` / `yarn typecheck` — lint and type-check
- `supabase start` — run Supabase locally
- `supabase db reset` — apply migrations to the local DB

## Notes for Claude

- **Status**: connected to Supabase. The kiosk flow (phone → name → services → tech →
  success) and an **admin area** (`/admin`) are built and run against a real Supabase
  project. See **SETUP.md** for creating the project, applying migrations, and making an
  admin user. Mock data is gone — all data access is via `src/lib/queries/` hooks.
  - **DB**: `supabase/migrations/0001_init.sql` (tables + base RLS) and
    `0002_admin_auth_rpcs.sql` (profiles/`is_admin`, kiosk `SECURITY DEFINER` RPCs
    `lookup_customer_by_phone`/`create_checkin`, notifications, tightened admin-only
    policies). Anon has **no blanket customer access** — the kiosk touches `customer`
    only through those RPCs.
  - **Auth**: Supabase email/password + a `profile.is_admin` flag. `AuthProvider` +
    `RequireAdmin` gate the admin routes.
  - **Admin**: customers list/detail, CSV import (preview + dedupe by phone) / export,
    and a Loyalty settings page (the kiosk's left-side card is now configurable).
  - **Notifications (SMS only, no email)**: real delivery via **ClickSend**.
    `queueNotification` (`src/lib/notifications.ts`) invokes the
    `supabase/functions/send-notification` Edge Function (Deno), which sends via the
    ClickSend REST API and records the result (`sent`/`failed`, or `stubbed` if creds are
    absent) in the `notification` table. To go live: `supabase functions deploy
    send-notification` and `supabase secrets set CLICKSEND_USERNAME=... CLICKSEND_API_KEY=...`.
    The check-in confirmation already fires through it. `send-notification` accepts either
    a built-in `template` (check-in messages) or a fully-rendered `message` (marketing);
    shared ClickSend/insert logic lives in `supabase/functions/_shared/sms.ts`.
  - **Marketing SMS (admin)**: reusable **SMS templates** (`sms_template` table, `{{name}}`
    / `{{reward}}` placeholders) managed at `/admin/sms-templates`, and a **campaign** sender
    at `/admin/marketing` that texts a chosen template to selected customers. Recipients are
    **restricted to opted-in customers** (`customer.marketing_consent`) — enforced in the UI
    and re-checkable server-side. Sends go one-per-recipient through `send-notification` with
    `kind='marketing'`.
  - **Birthday auto-SMS**: a `send-birthday-sms` Edge Function texts customers whose birthday
    is today (consented, not already texted this year via `customer.birthday_sms_year`),
    interpolating the active birthday program's reward into the `kind='birthday'` template. A
    daily **pg_cron** job (`daily-birthday-sms`, 09:00 UTC, migration `0004`) invokes it via
    `pg_net`, reading the function URL + service-role key from the `app_secret` table. To go
    live: `supabase functions deploy send-birthday-sms` and
    `insert into app_secret values ('edge_url','https://<ref>.functions.supabase.co'),
    ('service_role_key','<service-role-key>');`
  - **Loyalty**: multiple active programs supported (kiosk carousel + one redeemable promo
    each); rewards are **fixed `$` or `percent` off** (`reward_type`/`reward_value`, see
    `formatReward` in `src/lib/reward.ts`). Points are awarded +1 per check-in.
  - **Not yet built**: staff live queue / status transitions, and awarding points on
    `completed` (points are currently granted at check-in, not completion).
- The directory layout above still holds, now with `src/routes/admin/` and `src/lib/auth/`.
- When adding a feature that touches data, add/adjust the migration AND the RLS policy
  in the same change.
- Treat the kiosk UI as running unattended on a shared tablet: no dead ends, a clear
  "start over" path, and no exposure of other customers' data.
