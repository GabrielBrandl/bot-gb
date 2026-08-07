#!/bin/sh
set -e

cd /app/packages/database

echo "[api] Running Prisma migrations..."
pnpm exec prisma migrate deploy || {
  echo "[api] migrate deploy failed — attempting baseline..."
  for dir in prisma/migrations/*/ ; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    pnpm exec prisma migrate resolve --applied "$name" || true
  done
  pnpm exec prisma migrate deploy || true
}

echo "[api] Syncing schema with db push (fills gaps like missing plans table)..."
# Do not fail container boot if push reports warnings
set +e
pnpm exec prisma db push --skip-generate --accept-data-loss
PUSH_CODE=$?
set -e
echo "[api] db push exit=$PUSH_CODE"

echo "[api] Starting NestJS..."
cd /app/apps/api
exec node dist/main.js
