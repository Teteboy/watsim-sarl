#!/bin/bash
# One-time provisioning on a fresh Ubuntu VPS, run as root.
set -euo pipefail
[ "$EUID" -eq 0 ] || { echo "Run as root" >&2; exit 1; }
[ ! -e /var/www/watsim/.env ] || { echo "Already provisioned; refusing to overwrite secrets" >&2; exit 1; }
umask 077

apt-get update -y && apt-get upgrade -y
apt-get install -y curl openssl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx git build-essential postgresql postgresql-contrib redis-server certbot python3-certbot-nginx
npm install -g pm2

# App code, uploads, secrets and PM2 are owned by deploy, never www-data/root.
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
install -d -m 755 -o deploy -g deploy /var/www/watsim /var/www/watsim/frontend /var/www/watsim/backend /var/www/watsim/backend/uploads /var/log/watsim
install -d -m 755 /var/www/letsencrypt
POSTGRES_PASSWORD=$(openssl rand -base64 24)
REDIS_PASSWORD=$(openssl rand -hex 32)
# Percent-encode base64 characters in the database URI (SQL password stays raw).
DB_URL_PASSWORD=${POSTGRES_PASSWORD//+/%2B}
DB_URL_PASSWORD=${DB_URL_PASSWORD//\//%2F}
DB_URL_PASSWORD=${DB_URL_PASSWORD//=/%3D}
cat > /var/www/watsim/.env <<ENV
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
DATABASE_URL=postgresql://watsim_user:$DB_URL_PASSWORD@127.0.0.1:5432/watsim_db
REDIS_URL=redis://:$REDIS_PASSWORD@127.0.0.1:6379
ENV
chown deploy:deploy /var/www/watsim/.env
chmod 600 /var/www/watsim/.env
printf 'Generated PostgreSQL password (save securely): %s\n' "$POSTGRES_PASSWORD"

systemctl enable --now postgresql
runuser -u postgres -- psql -v ON_ERROR_STOP=1 <<SQL
CREATE USER watsim_user WITH PASSWORD '$POSTGRES_PASSWORD';
CREATE DATABASE watsim_db OWNER watsim_user;
GRANT ALL PRIVILEGES ON DATABASE watsim_db TO watsim_user;
SQL
# Ubuntu Redis defaults bind to loopback; retain that and require authentication.
sed -i '/^[[:space:]]*requirepass[[:space:]]/d' /etc/redis/redis.conf
printf '\nrequirepass %s\n' "$REDIS_PASSWORD" >> /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server

if command -v ufw >/dev/null 2>&1; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

# Configure systemd once, running PM2 as deploy; deploy script only saves state.
pm2 startup systemd -u deploy --hp /home/deploy
# Do not enable the TLS template until real domain/certificate paths exist.
install -m 644 /tmp/watsim-deploy/nginx.conf /etc/nginx/sites-available/watsim
printf '%s\n' 'Base setup complete. See deploy/README.md to authorize deploy SSH keys, merge generated secrets into backend/.env, provision TLS, and enable the Nginx site.'
