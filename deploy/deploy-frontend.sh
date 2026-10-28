#!/bin/bash
# =============================================================
# WATSIM Frontend Deploy Script
# Run from your LOCAL machine
# =============================================================
set -e

REMOTE_USER="deploy"           # Change to your VPS user
REMOTE_HOST="YOUR_VPS_IP"    # Your DigitalOcean droplet IP
REMOTE_DIR="/var/www/watsim/frontend"

echo "=== Building frontend ==="
# Set your production API URL so the frontend hits the right backend
VITE_API_BASE_URL=https://YOUR_DOMAIN npm run build

echo "=== Uploading frontend to VPS ==="
rsync -avz --delete out/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo "=== Setting permissions ==="
ssh $REMOTE_USER@$REMOTE_HOST "chmod -R u=rwX,go=rX $REMOTE_DIR"

echo ""
echo "Frontend deployed to https://YOUR_DOMAIN"
