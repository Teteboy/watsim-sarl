#!/bin/bash
# =============================================================
# WATSIM Backend Deploy Script
# Run from your LOCAL machine (or from the VPS after git pull)
# =============================================================
set -e

REMOTE_USER="deploy"           # Change to your VPS user
REMOTE_HOST="YOUR_VPS_IP"    # Your DigitalOcean droplet IP
REMOTE_DIR="/var/www/watsim/backend"

echo "=== Building backend locally ==="
cd backend
npm ci
npm run build
cd ..

echo "=== Backing up previous build before destructive sync ==="
# Reflink/copy rather than hardlinks: rsync must not modify the backup's inodes.
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && if [ -d dist ]; then rm -rf dist.bak && cp -a dist dist.bak; fi"

echo "=== Syncing backend to VPS ==="
rsync -avz --delete \
  --exclude node_modules \
  --exclude .env \
  --exclude "*.log" \
  backend/dist/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/dist/

rsync -avz \
  backend/package.json \
  backend/package-lock.json \
  $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

rsync -avz backend/prisma/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/prisma/"

rsync -avz deploy/ecosystem.config.cjs $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo "=== Installing production deps on VPS ==="
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && npm ci --omit=dev"

echo "=== Running Prisma migrations on VPS ==="
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && npx prisma migrate deploy"

echo "=== Generating Prisma client on VPS ==="
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && npx prisma generate"

echo "=== Restarting backend with PM2 ==="
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && pm2 startOrRestart ecosystem.config.cjs --env production && pm2 save"

# PM2 systemd startup is configured once by setup-vps.sh, not on every deploy.
echo "=== Checking backend health (must return HTTP 200) ==="
ssh "$REMOTE_USER@$REMOTE_HOST" 'bash -s' <<'HEALTH'
for attempt in {1..15}; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3001/health) || status=000
  if [ "$status" = 200 ]; then exit 0; fi
  sleep 2
done
echo "ERROR: backend health check failed (HTTP $status). Previous build is in dist.bak; inspect PM2 logs and follow deploy/README.md rollback steps." >&2
exit 1
HEALTH

echo ""
echo "Backend deployed! Check status: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 status'"
