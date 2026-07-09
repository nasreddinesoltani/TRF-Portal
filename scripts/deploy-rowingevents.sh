#!/usr/bin/env bash
#
# Production deploy script for rowingevents.tn (TRF Portal)
#
# Usage (on the server):
#   /var/www/rowingevents.tn/scripts/deploy-rowingevents.sh
#
# What it does:
#   1. Pulls the latest code
#   2. Installs backend + frontend deps and builds the frontend
#   3. (Re)starts the backend under PM2 in a reboot-safe way
#   4. Reloads Nginx
#   5. Runs a health check with retries
#
# Reboot safety:
#   The backend must be registered with PM2's boot service so it comes back
#   after a server reboot. Run these ONCE on the server (not part of this script):
#       pm2 startup            # then run the sudo command it prints
#       pm2 save
#   This script also runs `pm2 save` after every deploy to keep the frozen
#   process list up to date.

set -euo pipefail

APP_DIR="/var/www/rowingevents.tn"
APP_NAME="trf-portal"
HEALTH_URL="https://rowingevents.tn/api/health"
MAX_RETRIES=12
SLEEP_SECONDS=5

echo "==> Pull latest code"
cd "$APP_DIR"
git pull

echo "==> Install backend deps"
cd "$APP_DIR/backend"
npm ci

echo "==> Install frontend deps and build"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> Restart services"
cd "$APP_DIR"
# Restart if already running; otherwise start it.
# This handles a fresh boot / empty PM2 daemon, which previously caused
# `pm2 restart` (with `set -e`) to abort the whole deploy and leave a 502.
pm2 restart "$APP_NAME" --update-env \
  || pm2 start "$APP_DIR/backend/server.js" --name "$APP_NAME" --update-env
# Freeze the process list so PM2 restores it after a reboot.
pm2 save
sudo nginx -t
sudo systemctl reload nginx

echo "==> Health check with retry"
ok=0
for i in $(seq 1 "$MAX_RETRIES"); do
  code=$(curl -sS -o /tmp/rowingevents-health.json -w "%{http_code}" "$HEALTH_URL" || true)
  if [ "$code" = "200" ]; then
    ok=1
    echo "Health check passed (attempt $i/$MAX_RETRIES)"
    cat /tmp/rowingevents-health.json
    echo
    break
  fi
  echo "Health check not ready yet (attempt $i/$MAX_RETRIES, HTTP $code). Retrying in ${SLEEP_SECONDS}s..."
  sleep "$SLEEP_SECONDS"
done

if [ "$ok" -ne 1 ]; then
  echo "ERROR: Health check failed after $MAX_RETRIES attempts."
  echo "PM2 status:"
  pm2 status "$APP_NAME" || true
  echo "PM2 logs (last 80 lines):"
  pm2 logs "$APP_NAME" --lines 80 --nostream || true
  echo "Nginx error log (last 80 lines):"
  sudo tail -n 80 /var/log/nginx/error.log || true
  exit 1
fi

echo "Deploy finished successfully."
