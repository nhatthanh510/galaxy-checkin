# Setup — connecting Galaxy Check-In to Supabase

The app now talks to a real Supabase project. Follow these steps once.

## 1. Create a Supabase project

1. Go to https://supabase.com → create a new project.
2. In **Project Settings → API**, copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

## 2. Local env + install

This project uses **yarn**.

```bash
yarn install
cp .env.example .env
# then paste the two values into .env
```

The anon key is safe in the browser — Row Level Security enforces access.

## 3. Apply the schema

Run the migrations against your project, in order. Either paste each file into the
Supabase **SQL Editor** and run it, or use the CLI (`supabase db push`):

1. `supabase/migrations/0001_init.sql` — tables + base RLS
2. `supabase/migrations/0002_admin_auth_rpcs.sql` — profiles/admin, kiosk RPCs,
   notifications, tightened policies
3. `supabase/seed.sql` — services, technicians, loyalty program, sample customers

## 4. Create an admin user

1. **Authentication → Users → Add user** (email + password). Confirm the user.
2. The `on_auth_user_created` trigger creates a `profile` row automatically. Make it an
   admin — in the SQL Editor:

   ```sql
   update public.profile set is_admin = true
   where email = 'you@example.com';
   ```

3. Sign in at `/admin/login`.

## 5. (Optional) Notifications Edge Function

SMS/email are **stubbed** — the app records notification intent via the
`queue_notification` RPC (rows in `notification` with status `stubbed`). No message is
sent yet, and the app does not call the Edge Function today.

Two Supabase **Edge Functions** (Deno) send SMS via **ClickSend** (shared logic in
`supabase/functions/_shared/sms.ts`). Supabase hosts them; there's no server to run.

- `send-notification` — sends one SMS: check-in confirmations (built-in `template`) and
  marketing campaigns (fully-rendered `message`). Records a `notification` row.
- `send-birthday-sms` — texts today's birthdays (consented, once per year). Invoked daily
  by the `daily-birthday-sms` pg_cron job.

```bash
supabase functions deploy send-notification
supabase functions deploy send-birthday-sms
# ClickSend creds (once); without them, sends degrade to logged 'stubbed' rows:
supabase secrets set CLICKSEND_USERNAME=... CLICKSEND_API_KEY=... CLICKSEND_FROM=GalaxyNail
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Edge
runtime.

**Enable the daily birthday cron** (migration `0004` sets up the job, but it needs the
function URL + a service-role key to call itself). Run once in the SQL editor:

```sql
insert into app_secret (key, value) values
  ('edge_url', 'https://<project-ref>.functions.supabase.co'),
  ('service_role_key', '<your-service-role-key>')
on conflict (key) do update set value = excluded.value;
```

`app_secret` has no RLS policies, so only the service role / SECURITY DEFINER job reads it
— the keys never reach the browser. The job runs at 09:00 UTC; adjust the schedule in the
`cron.schedule('daily-birthday-sms', ...)` call if you want salon-local time.

> The IDE may flag `Deno`/`https://` imports in `index.ts` as errors — that's because the
> editor type-checks it as Node. It's a Deno file; it runs fine on deploy. Install the Deno
> VS Code extension for this folder to silence the warnings (optional).

## 6. Run

```bash
yarn dev
```

- Kiosk: `/`
- Admin: `/admin` (redirects to `/admin/login` until you sign in as an admin)
