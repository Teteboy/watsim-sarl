# WATSIM — VPS Deployment Guide

> **PRODUCTION SECURITY: Never run the database seed in production.** It creates demo accounts with known passwords such as `Admin@123`, `Merchant@123` and `Customer@123`. If seeded data has ever reached a live database, disable demo accounts and rotate all default passwords immediately. Use an approved production administrator provisioning process instead.

Stack: Nginx (HTTPS/static frontend) → PM2 (Fastify on port 3001) → PostgreSQL + authenticated Redis.

## 1. One-time provisioning

Use a fresh Ubuntu 22.04/24.04 VPS with your SSH key. From the repository root:

```bash
scp -r deploy/ root@YOUR_VPS_IP:/tmp/watsim-deploy/
ssh root@YOUR_VPS_IP
bash /tmp/watsim-deploy/setup-vps.sh
```

The script installs dependencies, creates a non-root `deploy` user, configures PM2 systemd startup **once**, generates database/Redis passwords, and writes `/var/www/watsim/.env` with mode 600. The database password is printed once; save it securely, never in source control. The script refuses to overwrite existing secrets. Package versions follow Ubuntu repositories (not necessarily PostgreSQL 16/Redis 7).

If UFW is installed, default incoming traffic is denied; OpenSSH, TCP 80 and 443 are allowed. Confirm your SSH port/profile before provisioning; adapt for nonstandard SSH ports. Never expose PostgreSQL, Redis or port 3001 publicly.

### Ownership model

`deploy` owns the app directories, uploads, environment files and `/var/log/watsim`. PM2 runs as `deploy`, not root; Nginx's `www-data` user only reads the public frontend. Root is used solely for system provisioning, TLS and Nginx administration. Add your authorized public key to `/home/deploy/.ssh/authorized_keys` with directory mode 700/file mode 600, owned by `deploy`, and verify SSH access before disabling root login. No application deploy requires sudo.

## 2. Backend environment

As `deploy`, copy the template then edit it:

```bash
cp /tmp/watsim-deploy/backend.env.example /var/www/watsim/backend/.env
chmod 600 /var/www/watsim/backend/.env
nano /var/www/watsim/backend/.env
```

Merge `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `DATABASE_URL` and `REDIS_URL` from `/var/www/watsim/.env`; do not overwrite the generated credentials with template placeholders. The generated database URL already percent-encodes its password. Set unique JWT secrets (`openssl rand -hex 64`), real domain URLs, payment/webhook credentials, and `USE_MOCK_PAYMENTS=false`. Production CamPay must explicitly use `CAMPAY_BASE_URL=https://www.campay.net` (unset defaults to demo). Smile ID callback: `/api/v1/auth/kyc/webhook/smile-id`.

Keep native uploads at `/var/www/watsim/backend/uploads`; back up uploads and PostgreSQL off-site. In Docker Compose, uploads persist in the named `uploads` volume mounted at `/app/uploads`; the API runs as `node` (UID 1000). Existing bind mounts/volumes must be writable by that UID. Never delete production volumes during updates. Compose requires `POSTGRES_PASSWORD` and `REDIS_PASSWORD` in `backend/.env`; use URL-safe hex values since connection URLs are constructed from them.

## 3. HTTPS (required)

The Nginx template is deliberately **not enabled** during provisioning: its certificate paths are placeholders. Point DNS at the server and obtain a certificate before enabling it. For initial issuance, stop Nginx temporarily and use standalone ACME (requires port 80 free):

```bash
systemctl stop nginx
certbot certonly --standalone -d YOUR_DOMAIN
nano /etc/nginx/sites-available/watsim
# Replace every YOUR_DOMAIN, including certificate paths, with your real domain.
ln -sf /etc/nginx/sites-available/watsim /etc/nginx/sites-enabled/watsim
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

Port 80 serves only ACME challenges and redirects to HTTPS. Port 443 serves the app with HSTS. Configure subsequent renewals for webroot `/var/www/letsencrypt` (rather than standalone, which would conflict with Nginx), enable the Certbot renewal timer and a deploy hook to reload Nginx, and verify with `certbot renew --dry-run`. Do not enable HSTS on a domain without working TLS.

## 4. Backend deployment

Set `REMOTE_HOST` in `deploy/deploy-backend.sh`; `REMOTE_USER` defaults to `deploy`. Run from the repository root:

```bash
bash deploy/deploy-backend.sh
```

This builds locally, copies the previous remote `dist/` to `dist.bak` **before** `rsync --delete`, installs production dependencies, deploys Prisma migrations, generates the client, restarts PM2 and saves its state. It then retries `http://127.0.0.1:3001/health` and fails loudly unless HTTP 200 is returned. It never seeds or re-runs PM2 startup.

Run PM2 commands as `deploy` (`sudo -iu deploy` when administering as root):

```bash
pm2 status
pm2 logs watsim-backend
```

### Manual code rollback

Inspect logs and confirm database migration compatibility first. `dist.bak` is a single previous-build backup, not a database/dependency rollback:

```bash
cd /var/www/watsim/backend
mv dist dist.failed
cp -a dist.bak dist
pm2 restart watsim-backend
curl -f http://127.0.0.1:3001/health
```

Retain separate database backups; schema changes may require a forward fix or a coordinated restore. The next deployment replaces `dist.bak`.

## 5. Frontend deployment

Set `REMOTE_HOST` and `YOUR_DOMAIN` in `deploy/deploy-frontend.sh` and run from repository root:

```bash
bash deploy/deploy-frontend.sh
```

The deploy user retains ownership; public build assets are readable by Nginx. Never place secrets in frontend environment variables or public build output.
