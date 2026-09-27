# Deploy Benefit Bridge to Vultr (Toronto)

The whole app runs on one Ubuntu server using Docker Compose:

| Container | What it does |
|---|---|
| `db` | Postgres 16. Its data lives in a Docker volume on the server and is never exposed to the internet. |
| `migrate` | Runs once on each deploy: applies database migrations, then seeds the programs. It never overwrites approved programs. |
| `web` | The Next.js app. |
| `worker` | Ingestion: bills, Gazette, program-page watching. |
| `caddy` | HTTPS reverse proxy. Gets and renews certificates automatically. |

All data stays on a server in Toronto. Deploying takes about 30 minutes, and the server costs about US$12/month.

---

## Step 1: Create the server

1. At <https://my.vultr.com>, go to **Deploy → Cloud Compute (Shared CPU)**.
2. **Location:** **Toronto**.
3. **Image:** **Ubuntu 24.04 LTS x64**.
4. **Plan:** at least **2 GB RAM** (the $12 plan). With 1 GB, the Next.js build runs out of memory.
5. **SSH key:** add yours. On Windows, run `ssh-keygen -t ed25519` in PowerShell, then paste the contents of `~/.ssh/id_ed25519.pub`.
6. **Server hostname:** `benefit-bridge`, then deploy. Copy the server's **IPv4 address** (for example `203.0.113.5`).

## Step 2: Choose the site address

HTTPS is required: browsers only allow the microphone on HTTPS, and Auth0 needs it.

- **You have a domain:** add a DNS **A record**, for example `benefits.example.ca`, pointing to the server IP. Wait until `nslookup benefits.example.ca` returns that IP.
- **No domain yet:** use a free `sslip.io` name built from the IP with dashes: `203-0-113-5.sslip.io`. It resolves to your server automatically, with no setup.

This address is your **SITE_DOMAIN**.

## Step 3: Prepare the server (once)

From your computer:

```bash
ssh root@203.0.113.5
```

On the server:

```bash
# Updates + firewall (SSH, HTTP, HTTPS only)
apt update && apt -y upgrade
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable

# Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version

# 2 GB of swap: gives headroom for the build on small plans
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## Step 4: Get the code

```bash
cd ~ && git clone https://github.com/shreyu1701/Benefit-Bridge-Hack-the-Hill-III.git benefit-bridge
cd benefit-bridge
```

If the repository is private, create a GitHub **fine-grained token** with read-only "Contents" access, and use `https://<token>@github.com/...` in the clone URL.

## Step 5: Configure secrets

```bash
cp deploy/env.production.example .env.production
nano .env.production
```

Fill in:

| Setting | Value |
|---|---|
| `SITE_DOMAIN` | Your domain or `203-0-113-5.sslip.io` |
| `APP_BASE_URL` | `https://` + the same address |
| `POSTGRES_PASSWORD` | Output of `openssl rand -hex 24` |
| `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` | Same keys as `.env.local` |
| `AUTH0_*` | From your Auth0 app, but `AUTH0_SECRET` must be **new**: `openssl rand -hex 32` |
| `PROFILE_ENCRYPTION_KEY` | **New** key: `openssl rand -base64 32`. Save a copy in your password manager. If it's lost, saved profiles can't be decrypted. |

Then lock the file down:

```bash
chmod 600 .env.production
```

## Step 6: Start everything

```bash
docker compose --env-file .env.production up -d --build
```

The first build takes 3–6 minutes. Then check:

```bash
docker compose ps                  # db/web/worker/caddy "running", migrate "exited (0)"
docker compose logs migrate        # "+ apply 001_init.sql" … "Seeded … 11 programs"
docker compose logs -f caddy       # "certificate obtained successfully" for your SITE_DOMAIN
```

Open `https://SITE_DOMAIN`. The landing page should load with a valid padlock.

## Step 7: Update Auth0 for the new address

In Auth0, go to **Applications → your app → Settings** and **add** the production URLs, keeping the localhost ones for development:

- **Allowed Callback URLs:** `https://SITE_DOMAIN/auth/callback`
- **Allowed Logout URLs:** `https://SITE_DOMAIN`
- **Allowed Web Origins:** `https://SITE_DOMAIN`

Save. Then check that **Sign in with Google** works on the live site.

## Step 8: Backups

```bash
chmod +x deploy/backup.sh && sh deploy/backup.sh      # test once
(crontab -l 2>/dev/null; echo "15 3 * * * cd $HOME/benefit-bridge && sh deploy/backup.sh >> deploy/backups/backup.log 2>&1") | crontab -
```

This keeps 14 days of backups in `deploy/backups/`. Also turn on **Vultr automatic backups** for the server; it costs a small extra fee and covers everything.

To restore a backup:

```bash
gunzip -c deploy/backups/<file>.sql.gz | docker compose exec -T db psql -U benefit_bridge benefit_bridge
```

---

## Deploying updates

```bash
cd ~/benefit-bridge
git pull
docker compose --env-file .env.production up -d --build
```

The `migrate` container runs again first, so new migrations are applied before the new web and worker containers start.

## Useful commands

```bash
docker compose logs -f web worker          # live logs
docker compose restart web                 # restart the app (e.g. after editing .env.production)
docker compose exec db psql -U benefit_bridge benefit_bridge   # database shell
docker compose down                        # stop (data is kept in the volume)
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Caddy: "no such host" or certificate errors | The DNS A record doesn't point to the server yet, or ports 80/443 are blocked. Check `ufw status` and the Vultr firewall. |
| Build killed / "JavaScript heap out of memory" | Use the 2 GB plan and make sure swap is on (`swapon --show`). |
| "Callback URL mismatch" at sign-in | Add the `https://SITE_DOMAIN/...` URLs in Auth0 (Step 7). |
| `JWEDecryptionFailed` | `AUTH0_SECRET` changed. Clear the site's cookies. |
| "Automatic understanding has reached its daily limit" | The Gemini free-tier quota is used up. It resets daily, or you can add billing to the Google AI project. |
| "Listen" uses the browser voice | ElevenLabs refused the request. Check `docker compose logs web` for `ElevenLabs text-to-speech HTTP …`. |
