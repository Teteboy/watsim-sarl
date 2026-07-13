#!/bin/bash
# =============================================================
# WATSIM Backend Deploy Script
# Run from your LOCAL machine (or from the VPS after git pull)
# =============================================================
set -e

REMOTE_USER="root"           # Change to your VPS user
REMOTE_HOST="YOUR_VPS_IP"    # Your DigitalOcean droplet IP
REMOTE_DIR="/var/www/watsim/backend"

echo "=== Building backend locally ==="
cd backend
npm ci
npm run build
cd ..

echo "=== Syncing backend to VPS ==="
rsync -avz --delete \
  --exclude node_modules \
  --exclude .env \
  --exclude "*.log" \
  backend/dist/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/dist/

rsync -avz \
  backend/package.json \
  backend/package-lock.json \
  backend/prisma/ \
  $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

rsync -avz deploy/ecosystem.config.cjs $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo "=== Installing production deps on VPS ==="
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && npm ci --omit=dev"

echo "=== Running Prisma migrations on VPS ==="
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && npx prisma migrate deploy"

echo "=== Generating Prisma client on VPS ==="
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && npx prisma generate"

echo "=== Restarting backend with PM2 ==="
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && pm2 startOrRestart ecosystem.config.cjs --env production && pm2 save"

echo "=== Saving PM2 startup ==="
ssh $REMOTE_USER@$REMOTE_HOST "pm2 startup systemd -u $REMOTE_USER --hp /root && pm2 save"

echo ""
echo "Backend deployed! Check status: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 status'"
