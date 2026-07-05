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

`supabase/functions/send-notification/` is a Supabase **Edge Function** (Deno) that does
the same stubbed insert — it's where real Twilio/email delivery goes later. Supabase hosts
it; there's no server to run and no port to manage. Deploy it when you're ready:

```bash
supabase functions deploy send-notification
# set provider secrets as function env vars (only needed once you wire real delivery):
supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Edge
runtime. When you're ready for real delivery, fill in the `TODO(twilio/email)` in
`index.ts` and switch `src/lib/notifications.ts` to call
`supabase.functions.invoke('send-notification', { body })` instead of the RPC.

> The IDE may flag `Deno`/`https://` imports in `index.ts` as errors — that's because the
> editor type-checks it as Node. It's a Deno file; it runs fine on deploy. Install the Deno
> VS Code extension for this folder to silence the warnings (optional).

## 6. Run

```bash
yarn dev
```

- Kiosk: `/`
- Admin: `/admin` (redirects to `/admin/login` until you sign in as an admin)
