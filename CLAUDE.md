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
- **Secrets** (Twilio keys, service-role key) live only in Edge Function env vars and
  `.env` (gitignored) — never in client code or committed files.
- **Data access** goes through hooks in `src/lib/queries/`, not inline Supabase calls
  in components.
- Prefer small, focused components; keep the kiosk flow’s steps as separate route
  components.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run lint` / `npm run typecheck` — lint and type-check
- `supabase start` — run Supabase locally
- `supabase db reset` — apply migrations to the local DB

## Notes for Claude

- **Status**: scaffolded. The customer-facing kiosk flow (phone → name → services →
  tech → success) is built and runs on **in-memory mock data** (`src/lib/mock/data.ts`)
  behind the query hooks in `src/lib/queries/`. The Supabase schema + RLS is authored in
  `supabase/migrations/0001_init.sql` (with `seed.sql`) but **not yet connected** — swap a
  hook from mock to Supabase to wire it up. SMS is deferred: the single integration point
  is the `TODO(sms)` in `src/lib/queries/useCreateCheckin.ts`. Not yet built: staff
  dashboard/queue, loyalty-award-on-`completed`, and the `send-sms` Edge Function.
- The directory layout above matches reality; the produced structure follows it. When
  scaffolding further, keep it consistent or update this file.
- When adding a feature that touches data, add/adjust the migration AND the RLS policy
  in the same change.
- Treat the kiosk UI as running unattended on a shared tablet: no dead ends, a clear
  "start over" path, and no exposure of other customers' data.
