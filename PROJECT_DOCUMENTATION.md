# WATSIM — Project Documentation

## 1. Overview

**WATSIM** is a Buy Now Pay Later (BNPL) fintech platform for the Cameroonian and Central African market. It lets verified customers buy from partner merchants and pay back in 1, 2, 3 or 6 monthly installments using Orange Money, MTN MoMo, or their WATSIM e-wallet.

Three roles are supported:
- **Admin** — manages users, merchants, KYC, credit limits, reports.
- **Merchant** — registers, lists products, fulfills orders, tracks sales.
- **Customer** — registers, completes KYC, simulates and creates BNPL purchases, repays installments.

---

## 2. Architecture

```
┌─────────────────┐       HTTPS        ┌────────────────────┐
│  React + Vite   │  ───────────────►  │  Fastify API (Node 20) │
│  (frontend)     │                    │  /api/v1/*             │
└─────────────────┘                    └────────────────────┘
        │                                 │     │     │
        │                                 ▼     ▼
        │                            Postgres Redis
        │                              16    7
        ▼                                 ▲
   Mobile money                        BullMQ workers
   (Orange / MTN)                      (cron + jobs)
```

- **Frontend**: `./src/` — React 19, Vite, Tailwind CSS, i18next.
- **Backend**: `./backend/` — Fastify, Prisma, BullMQ.
- **DB**: PostgreSQL 16 (user `watsim`, password `allpha01`, db `watsim_db`).
- **Cache / jobs**: Redis 7.
- **Storage**: Local filesystem (`uploads/` folder) for KYC docs and images.

---

## 3. Repo layout

```
WATSIM/
├── src/                          # React frontend
│   ├── lib/api.ts                # ← API client (talks to backend)
│   ├── hooks/useAdminAuth.ts     # ← calls backend on login
│   ├── hooks/useMerchantAuth.ts  # ← calls backend on login
│   └── ...
├── backend/                      # Node.js API
│   ├── src/
│   │   ├── app.ts, server.ts
│   │   ├── modules/{auth,users,bnpl,merchants,products,payments,admin}
│   │   ├── services/{credit-scoring,notification,storage}.service.ts
│   │   ├── jobs/{queue,repayment,score-update,kyc-verify}.job.ts
│   │   ├── middleware/{authenticate,authorize,rate-limit}.ts
│   │   └── config/{env,db,redis,logger}.ts
│   ├── prisma/{schema.prisma,seed.ts}
│   ├── tests/{auth,bnpl,payments}.test.ts
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── SETUP.md
│   └── API.md
├── .env.example                  # frontend env (VITE_API_BASE_URL)
└── PROJECT_DOCUMENTATION.md      # ← this file
```

---

## 4. Business rules

### 4.1 BNPL interest (OHADA-safe, flat, no compounding)
| Installments | Flat rate |
|---|---|
| 1  | 0 % |
| 2  | 2 % |
| 3  | 4 % |
| 6  | 8 % |

Installments are spaced **30 days** apart; the first is due 30 days after purchase.

### 4.2 Credit scoring (0–100)
```
score = 50
  + (KYC verified ?       +20 : 0)
  + min(completed_purchases × 3, 15)
  − overdue_instalments × 10
  + min(wallet_deposits × 1, 5)
  + min(on_time_streak × 2, 10)
```

### 4.3 Credit limit tiers
| Score    | Limit (XAF) |
|----------|-------------|
| 0 – 39   | 0           |
| 40 – 59  | 25,000      |
| 60 – 74  | 75,000      |
| 75 – 89  | 150,000     |
| 90 – 100 | 300,000     |

### 4.4 Money & dates
- All amounts: integer XAF.
- All timestamps: stored UTC, displayed `Africa/Douala` (UTC+1).

---

## 5. Frontend ↔ backend wiring

The frontend talks to the backend through `src/lib/api.ts`:

- `VITE_API_BASE_URL` defaults to `http://localhost:3001/api/v1`.
- Access token lives in `localStorage.watsim_access_token`; refresh token in `localStorage.watsim_refresh_token`; user in `localStorage.watsim_user`.
- The client automatically attempts refresh-token rotation on a 401 and retries the original request.
- `useAdminAuth` / `useMerchantAuth` now call `authApi.login()` and only succeed when the backend returns the matching role.
- Existing role-restricted demo emails still work because the backend's seed creates real admin/merchant accounts.

To wire more screens to live data, import `adminApi`, `merchantApi`, `bnplApi` from `@/lib/api`.

---

## 6. Local development (TL;DR)

```bash
# 1. backend
cd backend
cp .env.example .env
docker compose up -d db redis
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev          # http://localhost:3001

# 2. frontend (new terminal, repo root)
cp .env.example .env
npm install
npm run dev          # http://localhost:3000 (or :5173)
```

See `backend/SETUP.md` for full details and `backend/API.md` for curl examples.

---

## 7. Deployment on Hostinger

Hostinger now offers two viable paths for WATSIM:

| Path | Plan | Best for |
|---|---|---|
| **A. Managed Node.js Web Apps** | **Business** or **Cloud Startup/Pro/Enterprise** Web Hosting | Fastest setup, no server admin. Node 18/20/22/24 managed by Hostinger. Recommended for production. |
| **B. VPS (Docker)** | KVM 2 / 4 / 8 | Full control, run Postgres + Redis locally on the same box. |

For both paths the **React frontend** is built to static assets and served either from the same Node app, from `public_html`, or from a separate static site on Hostinger.

> **External services you will need either way:**
> - **Postgres** — either Hostinger Cloud DB, Supabase, Neon, or Railway (free tiers available).
> - **Redis** — Upstash (free 10k commands/day) or Redis Cloud. Required for BullMQ jobs (repayment cron, KYC worker).
> - **File storage** — Local filesystem (stored in `backend/uploads/` folder).

---

## 7-bis. Hostinger Business — Managed Node.js Web App (recommended)

### 7-bis.1 Provision the Node.js app
1. Log in to **hPanel → Websites → Manage** for your domain.
2. Open **Advanced → Node.js Web Apps** (or **Hosting → Node.js**).
3. Click **Create application** and set:
   - Node.js version: **20.x** (LTS)
   - Application mode: **Production**
   - Application root: `watsim/backend` (path inside your site folder)
   - Application URL: `api.yourdomain.cm` (subdomain you've already created)
   - Application startup file: `dist/server.js`
4. Save. Hostinger creates a Phusion Passenger-managed Node process and binds it to the subdomain over HTTPS automatically (free Let's Encrypt cert via hPanel → SSL).

### 7-bis.2 Push the code via Git
Hostinger Business includes **Git deployments**.

1. hPanel → **Advanced → Git** → **Create repository**.
2. Add your GitHub repo URL and the branch (`main`).
3. Deploy path: the same path you set as the Node app root.
4. Save and click **Deploy**.

Alternatively upload a ZIP via **File Manager**.

### 7-bis.3 Provision external Postgres + Redis
- **Postgres**: in hPanel go to **Databases → Remote MySQL/PostgreSQL** OR sign up for Neon/Supabase. Copy the connection string.
- **Redis**: sign up at upstash.com → create a database → copy the `redis://` URL.

### 7-bis.4 Environment variables
hPanel → **Node.js Web Apps → your app → Environment variables**. Add (do NOT commit these):
```
NODE_ENV=production
PORT=3000                       # Hostinger maps this to 443 via Passenger
HOST=0.0.0.0
FRONTEND_URL=https://app.yourdomain.cm
DATABASE_URL=postgresql://USER:PASS@HOST:5432/watsim_db?schema=public&sslmode=require
REDIS_URL=rediss://default:PASS@HOST:6379
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
USE_MOCK_PAYMENTS=false
CAMPAY_APP_USERNAME=...
CAMPAY_APP_PASSWORD=...
CAMPAY_WEBHOOK_KEY=...
USE_SMILE_ID=true
SMILE_ID_PARTNER_ID=...
SMILE_ID_API_KEY=...
SMILE_ID_BASE_URL=https://api.smileidentity.com
SMILE_ID_CALLBACK_URL=https://api.yourdomain.cm/api/v1/auth/kyc/webhook/smile-id
```

### 7-bis.5 Build & migrate
SSH into your Hostinger account (hPanel → **Advanced → SSH Access**) and run:
```bash
cd ~/domains/yourdomain.cm/public_html/watsim/backend
npm ci --omit=dev=false
npm run build                     # tsc → dist/
npx prisma migrate deploy
npx prisma db seed                # optional, only the first time
```

### 7-bis.6 Restart the Passenger app
hPanel → **Node.js Web Apps → your app → Restart**. The Fastify server now serves `https://api.yourdomain.cm`.

### 7-bis.7 Deploy the React frontend
The static React app goes in the main `public_html` of your primary domain.
```bash
# locally, in repo root
echo 'VITE_API_BASE_URL=https://api.yourdomain.cm/api/v1' > .env
npm ci && npm run build
# upload contents of /dist (or /out) to public_html via File Manager / SFTP
```
Add a `.htaccess` in `public_html` for client-side routing:
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### 7-bis.8 CamPay & Smile ID webhook URLs
After the API is reachable on HTTPS, register these URLs:
- **CamPay** dashboard → Webhooks → `https://api.yourdomain.cm/api/v1/payments/webhook/campay`
- **Smile ID** portal → Callback URL → `https://api.yourdomain.cm/api/v1/auth/kyc/webhook/smile-id`

### 7-bis.9 Background jobs on shared Node
Phusion Passenger keeps a single Node process alive. BullMQ workers run **in-process** inside the Fastify app (see `backend/src/jobs/queue.ts`). The daily repayment cron (`06:00 Africa/Douala`) executes within that same process — no extra worker dyno needed.

If you scale to multiple Hostinger app instances later, move the cron to a separate Hostinger **Cron Jobs** entry that calls a protected admin endpoint, to avoid duplicate firings.

---

## 8. Hostinger VPS deployment — step by step (alternative)

### 8.1 Provision
1. Buy a **Hostinger VPS** (KVM 2 minimum: 2 vCPU / 8 GB RAM / 100 GB SSD recommended).
2. In **hPanel → VPS → Operating System**, install **Ubuntu 22.04 with Docker** (Hostinger ships a pre-baked image).
3. Note the public IP and root password, then SSH in:
   ```bash
   ssh root@<vps-ip>
   ```
4. Create a non-root user and disable root SSH:
   ```bash
   adduser deploy && usermod -aG sudo,docker deploy
   rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
   sed -i 's/^PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
   systemctl restart ssh
   ```

### 8.2 DNS
In hPanel → **Domains → DNS / Nameservers**, create:
- `api.yourdomain.cm` → `A` → `<vps-ip>`
- `app.yourdomain.cm` → `A` → `<vps-ip>` (or use existing Hostinger hosting)

### 8.3 Get the code
```bash
sudo -iu deploy
git clone https://github.com/<you>/watsim.git
cd watsim/backend
cp .env.example .env
nano .env       # edit secrets (see below)
```

Set in `.env`:
```
NODE_ENV=production
FRONTEND_URL=https://app.yourdomain.cm
DATABASE_URL=postgresql://watsim:allpha01@db:5432/watsim_db?schema=public
JWT_ACCESS_SECRET=<random 48+ chars>
JWT_REFRESH_SECRET=<random 48+ chars>
USE_MOCK_PAYMENTS=false        # once Orange/MTN creds are real
```

### 8.4 Bring up the stack
```bash
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run db:seed   # optional, only once
docker compose logs -f api
```
The API is now reachable on `http://<vps-ip>:3001`.

### 8.5 Nginx + free TLS (Let's Encrypt)
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
sudo tee /etc/nginx/sites-available/watsim-api <<'NGX'
server {
  listen 80;
  server_name api.yourdomain.cm;
  client_max_body_size 15m;
  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGX
sudo ln -s /etc/nginx/sites-available/watsim-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.cm --redirect -m you@yourdomain.cm --agree-tos -n
```

### 8.6 Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 8.7 Deploy the React frontend (on the same VPS)
```bash
cd ~/watsim
echo 'VITE_API_BASE_URL=https://api.yourdomain.cm/api/v1' > .env
npm ci
npm run build
sudo mkdir -p /var/www/watsim
sudo rsync -a out/ /var/www/watsim/

sudo tee /etc/nginx/sites-available/watsim-app <<'NGX'
server {
  listen 80;
  server_name app.yourdomain.cm;
  root /var/www/watsim;
  index index.html;
  location / { try_files $uri /index.html; }
}
NGX
sudo ln -s /etc/nginx/sites-available/watsim-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.yourdomain.cm --redirect -n --agree-tos -m you@yourdomain.cm
```

### 8.8 Updates
```bash
cd ~/watsim
git pull
# backend
cd backend && docker compose up -d --build && docker compose exec api npx prisma migrate deploy
# frontend
cd .. && npm ci && npm run build && sudo rsync -a --delete out/ /var/www/watsim/
```

### 8.9 Backups (Postgres)
```bash
# /etc/cron.daily/watsim-pg
docker exec watsim_db pg_dump -U watsim watsim_db | gzip > /var/backups/watsim_$(date +\%F).sql.gz
find /var/backups -name 'watsim_*.sql.gz' -mtime +14 -delete
```

### 8.10 Hosting the frontend on Hostinger shared hosting (alternative)
1. Build locally: `npm run build` → creates `out/`.
2. In hPanel → File Manager → `public_html`, upload the contents of `out/`.
3. Set `VITE_API_BASE_URL=https://api.yourdomain.cm/api/v1` in your local `.env` before building.
4. Add `.htaccess` for SPA routing:
   ```apache
   RewriteEngine On
   RewriteRule ^index\.html$ - [L]
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.html [L]
   ```

---

## 9. Production checklist

- [ ] Strong, unique `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (≥ 48 chars).
- [ ] Strong Postgres password (rotate the default `allpha01`).
- [ ] `NODE_ENV=production`, `USE_MOCK_PAYMENTS=false`.
- [ ] `FRONTEND_URL` set so CORS is locked to your real domain.
- [ ] Real Orange Money + MTN MoMo credentials, real webhook secrets.
- [ ] HTTPS on both `api.*` and `app.*` (Let's Encrypt auto-renew installed by Certbot).
- [ ] Daily Postgres backup off-site (Hostinger object storage or external storage).
- [ ] `prisma migrate deploy` run after every release.
- [ ] Monitoring: enable Hostinger VPS resource alerts; tail `docker compose logs -f api` after deploys.

---

## 10. Where to look next

- Add unit tests under `backend/tests/`.
- Wire more frontend screens to `adminApi`, `merchantApi`, `bnplApi` in `src/lib/api.ts`.
- Replace the mock payment adapters with the real Orange Money Web Pay and MTN MoMo Collections APIs (the adapter interface in `backend/src/modules/payments/providers/types.ts` already matches both).
- Add an OpenAPI / Swagger plugin (`@fastify/swagger`) to publish `API.md` interactively.
