#!/bin/bash
# =============================================================
# WATSIM VPS Setup Script
# Run on a fresh Ubuntu 22.04 / 24.04 Droplet as root or sudo
# Usage: bash setup-vps.sh
# =============================================================
set -e

echo "=== [1/8] System update ==="
apt-get update -y && apt-get upgrade -y

echo "=== [2/8] Install Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "=== [3/8] Install tools: nginx, git, pm2, certbot ==="
apt-get install -y nginx git build-essential
npm install -g pm2
apt-get install -y certbot python3-certbot-nginx

echo "=== [4/8] Install PostgreSQL 16 ==="
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

echo "=== [5/8] Install Redis 7 ==="
apt-get install -y redis-server
sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl start redis-server

echo "=== [6/8] Create PostgreSQL DB and user ==="
sudo -u postgres psql <<SQL
CREATE USER watsim_user WITH PASSWORD 'CHANGE_THIS_PASSWORD';
CREATE DATABASE watsim_db OWNER watsim_user;
GRANT ALL PRIVILEGES ON DATABASE watsim_db TO watsim_user;
SQL
echo "  !! Change watsim_user password in /etc/postgresql/.../pg_hba.conf and .env !!"

echo "=== [7/8] Create app directories ==="
mkdir -p /var/www/watsim/frontend
mkdir -p /var/www/watsim/backend
mkdir -p /var/log/watsim
chown -R www-data:www-data /var/www/watsim
chmod -R 755 /var/www/watsim

echo "=== [8/8] Configure Nginx ==="
cp /tmp/watsim-deploy/nginx.conf /etc/nginx/sites-available/watsim
ln -sf /etc/nginx/sites-available/watsim /etc/nginx/sites-enabled/watsim
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=========================================="
echo " VPS base setup complete!"
echo " Next steps:"
echo "  1. Edit /etc/nginx/sites-available/watsim → set YOUR_DOMAIN"
echo "  2. Copy backend files: see deploy-backend.sh"
echo "  3. Copy frontend build: see deploy-frontend.sh"
echo "  4. Run certbot: certbot --nginx -d YOUR_DOMAIN"
echo "=========================================="
