# Deploy: Vercel website + managed Postgres + worker on Vultr

```
Vercel (website + /api)  ─┐
                          ├── TLS ──▶  Managed Postgres, Canada (Supabase "Canada Central")
Vultr (worker, Docker)   ─┘            profiles (encrypted), bills, program data
```

| Part | Where | Why |
|---|---|---|
| Website and API | Vercel: <https://benefit-bridge-hack-the-hill-iii.vercel.app> | Deploys automatically on `git push` |
| Database | Supabase Postgres in **Canada (Central)** | Reachable from Vercel and Vultr; backups handled by Supabase |
| Ingestion worker | Vultr server, Docker (`docker-compose.worker.yml`) | Vercel can't run always-on processes. The server opens **no inbound ports**. |

> **Data location:** the database is in Canada. Vercel runs the API functions in its
> own regions (the default is Washington, D.C., `iad1`), so a person's text passes
> through there in memory while it's processed. Nothing is stored there. If you need
> everything in Canada, use the all-Vultr setup in `docs/DEPLOY.md`.

---

## Step 1: Create the database (Supabase)

1. At <https://supabase.com/dashboard>, click **New project**.
   - **Region:** **Canada (Central)**
   - **Database password:** generate one and save it in your password manager.
2. When the project is ready, click **Connect** (top bar) and copy **two** connection strings:
   - **Transaction pooler** (port **6543**), for Vercel. Serverless functions open many short connections.
   - **Session pooler** (port **5432**), for the worker. It holds a session lock so only one worker runs at a time.

   Replace `[YOUR-PASSWORD]` in both, and add `?sslmode=require` to the end of each.
3. Go to **Project Settings → Database → SSL Configuration → Download certificate**. Open the `.crt` file in a text editor; this is the value for `DATABASE_CA_CERT`. Vercel accepts it as-is, multi-line. In `.env.worker`, put it on one line with `\n` between lines.

## Step 2: Create the tables (from your PC, once)

In PowerShell, in the project folder:

```powershell
$env:DATABASE_URL = "<session pooler URL>?sslmode=require"
$env:DATABASE_CA_CERT = Get-Content -Raw "$HOME\Downloads\prod-ca-2021.crt"
npx tsx scripts/migrate.ts
npx tsx scripts/seed.ts
```

Expected output: `+ apply 001_init.sql` … `+ apply 004_users_profiles.sql`, then `Seeded 3 jurisdictions, 8 laws, 11 programs.`
(The worker's `migrate` step also does this on every start, so skipping this step is fine.)

## Step 3: Set Vercel's environment variables

Go to Vercel → your project → **Settings → Environment Variables**, choose the **Production** environment, and add:

| Name | Value |
|---|---|
| `DATABASE_URL` | Transaction pooler URL (port 6543) + `?sslmode=require` |
| `DATABASE_CA_CERT` | Contents of the Supabase `.crt` file |
| `PG_POOL_MAX` | `3` |
| `PROFILE_ENCRYPTION_KEY` | A **new** key: `openssl rand -base64 32`. Save it; if it's lost, saved profiles can't be decrypted. |
| `GEMINI_API_KEY` | Your key |
| `GEMINI_MODEL` | `gemini-flash-latest` |
| `GEMINI_FALLBACK_MODEL` | `gemini-flash-lite-latest` |
| `ELEVENLABS_API_KEY` | Your key |
| `ELEVENLABS_VOICE_ID` | `EXAVITQu4vr4xnSDxMaL` (Sarah, a built-in voice) |
| `ELEVENLABS_TTS_MODEL` | `eleven_multilingual_v2` |
| `ELEVENLABS_STT_MODEL` | `scribe_v1` |
| `APP_BASE_URL` | `https://benefit-bridge-hack-the-hill-iii.vercel.app` |
| `AUTH0_DOMAIN` | Your tenant, e.g. `dev-xxxx.us.auth0.com` (no `https://`) |
| `AUTH0_CLIENT_ID` | From Auth0 |
| `AUTH0_CLIENT_SECRET` | From Auth0 |
| `AUTH0_SECRET` | A **new** value: `openssl rand -hex 32` (64 hex characters) |
| `ADMIN_EMAILS` | Reviewer emails, comma-separated |

Then go to **Deployments → ⋯ on the latest → Redeploy**. Environment variables only apply to new deployments.

## Step 4: Add the Vercel address to Auth0

Go to Auth0 → **Applications → your app → Settings** and **add**, keeping the localhost entries:

- **Allowed Callback URLs:** `https://benefit-bridge-hack-the-hill-iii.vercel.app/auth/callback`
- **Allowed Logout URLs:** `https://benefit-bridge-hack-the-hill-iii.vercel.app`
- **Allowed Web Origins:** `https://benefit-bridge-hack-the-hill-iii.vercel.app`

Save. Check that **Connections → google-oauth2** is on for this app.

## Step 5: Run the worker on Vultr

On the server, after Docker is installed and the repo is cloned (`docs/DEPLOY.md`, steps 3–4):

```bash
cd ~/benefit-bridge
git pull
cp deploy/env.worker.example .env.worker
nano .env.worker            # DATABASE_URL = SESSION pooler URL, DATABASE_CA_CERT, GEMINI_API_KEY
chmod 600 .env.worker
docker compose -f docker-compose.worker.yml --env-file .env.worker up -d --build
```

Check it:

```bash
docker compose -f docker-compose.worker.yml ps          # worker "running", migrate "exited (0)"
docker compose -f docker-compose.worker.yml logs -f worker
# within a minute: [legisinfo] { parliament: 45, session: 1, bills_seen: …, royal_assents_new: [...] }
```

The server doesn't need ports 80 or 443 for this setup, only SSH.

## Step 6: Check the live site

| Check | Expected |
|---|---|
| <https://benefit-bridge-hack-the-hill-iii.vercel.app/laws> | A list of current federal and Ontario bills |
| `/api/account` | `"authAvailable":true` |
| `/start` → **Sign in with Google** | Google sign-in, then back to onboarding |
| Describe → type or speak → **Find my benefits** | The confirm screen with extracted facts |
| Results → **Listen** | Plays audio (ElevenLabs) |

## Updating

- **Website:** `git push` to `main`. Vercel redeploys automatically.
- **Worker:** on the server, `git pull && docker compose -f docker-compose.worker.yml --env-file .env.worker up -d --build`. New migrations run first.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `self-signed certificate in certificate chain` | `DATABASE_CA_CERT` is missing or incomplete. Paste the whole `.crt`, including the BEGIN/END lines. |
| `remaining connection slots are reserved` / too many clients | Vercel must use the **transaction** pooler (6543) with `PG_POOL_MAX=3`. |
| Worker says "Another worker holds the lock" | Another worker is still connected, or the worker uses the transaction pooler. Use the **session** pooler (5432). |
| `/api/account` still shows `authAvailable:false` | One of the four `AUTH0_*` values is missing on Vercel, or you haven't redeployed. |
| "Callback URL mismatch" | Step 4 is missing, or the URL has a typo or a trailing slash. |
