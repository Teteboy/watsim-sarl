# WATSIM — VPS Deployment Guide

Stack: **React/Vite frontend** + **Fastify backend** on a single Ubuntu 22.04 DigitalOcean Droplet.  
Architecture: **Nginx** (reverse proxy + static files) → **PM2** (Fastify) → **PostgreSQL** + **Redis**

---

## 1. Create a DigitalOcean Droplet

- Go to https://cloud.digitalocean.com → **Create Droplet**
- Image: **Ubuntu 22.04 LTS**
- Size: **Basic — 2 GB RAM / 1 vCPU** ($12/mo minimum for this stack)
- Add your **SSH key** (recommended) or use a password
- Note the **Droplet IP**

---

## 2. Run the VPS setup script

Copy the deploy folder to your server and run setup:

```bash
# From your LOCAL machine (Windows: use Git Bash or WSL)
scp -r deploy/ root@YOUR_VPS_IP:/tmp/watsim-deploy/
ssh root@YOUR_VPS_IP
bash /tmp/watsim-deploy/setup-vps.sh
```

This installs: Node 20, Nginx, PostgreSQL 16, Redis 7, PM2, Certbot.

---

## 3. Configure the backend environment

```bash
# On the VPS
cp /tmp/watsim-deploy/backend.env.example /var/www/watsim/backend/.env
nano /var/www/watsim/backend/.env
```

**Must fill in:**
- `DATABASE_URL` — use the password you set in `setup-vps.sh`
- `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` — generate with:  
  `openssl rand -hex 64`
- `FRONTEND_URL` — your domain e.g. `https://watsim.cm`
- Payment provider keys (CamPay, Twilio, etc.)

---

## 4. Configure Nginx

```bash
# On the VPS
nano /etc/nginx/sites-available/watsim
```

Replace `YOUR_DOMAIN_OR_IP` with your actual domain or droplet IP.

```bash
nginx -t && systemctl reload nginx
```

---

## 5. Deploy the backend

Edit `deploy/deploy-backend.sh`:
- Set `REMOTE_USER` (default: `root`)
- Set `REMOTE_HOST` to your droplet IP

```bash
# From your LOCAL machine (Git Bash / WSL)
bash deploy/deploy-backend.sh
```

This will:
1. Build TypeScript → `dist/`
2. `rsync` to VPS
3. `npm ci --omit=dev`
4. Run `prisma migrate deploy`
5. Start/restart with PM2

---

## 6. Deploy the frontend

Edit `deploy/deploy-frontend.sh`:
- Set `REMOTE_USER`, `REMOTE_HOST`, and `YOUR_DOMAIN`

```bash
# From your LOCAL machine
bash deploy/deploy-frontend.sh
```

---

## 7. (Optional but recommended) Set up HTTPS with Let's Encrypt

```bash
# On the VPS — replace with your actual domain
certbot --nginx -d watsim.cm -d www.watsim.cm
```

Then uncomment the HTTPS block in `nginx.conf` and remove the HTTP block.

---

## 8. Seed the database (first time only)

```bash
# On the VPS
cd /var/www/watsim/backend
npx tsx prisma/seed.ts
```

---

## Useful commands on the VPS

```bash
# Check backend status
pm2 status
pm2 logs watsim-backend

# Restart backend
pm2 restart watsim-backend

# Check Nginx
systemctl status nginx
nginx -t

# Check PostgreSQL
systemctl status postgresql
sudo -u postgres psql -c '\l'

# Check Redis
redis-cli ping
```

---

## Re-deploy after code changes

```bash
# Backend only
bash deploy/deploy-backend.sh

# Frontend only
bash deploy/deploy-frontend.sh

# Both
bash deploy/deploy-backend.sh && bash deploy/deploy-frontend.sh
```

---

## Firewall (ufw)

```bash
# On the VPS
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## Files in this folder

| File | Purpose |
|------|---------|
| `setup-vps.sh` | One-time VPS provisioning (run once on fresh server) |
| `nginx.conf` | Nginx site config (copy to `/etc/nginx/sites-available/watsim`) |
| `ecosystem.config.cjs` | PM2 process config for the backend |
| `backend.env.example` | Template for production `.env` |
| `deploy-backend.sh` | Build + sync + restart backend |
| `deploy-frontend.sh` | Build + sync frontend static files |
