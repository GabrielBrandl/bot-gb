#!/bin/sh
set -e

cd /app/packages/database

echo "[api] Running Prisma migrations..."
if ! pnpm exec prisma migrate deploy; then
  echo "[api] migrate deploy failed — attempting baseline for non-empty DB (P3005)..."
  for dir in prisma/migrations/*/ ; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    echo "[api] prisma migrate resolve --applied $name"
    pnpm exec prisma migrate resolve --applied "$name" || true
  done
  pnpm exec prisma migrate deploy
fi

echo "[api] Starting NestJS..."
cd /app/apps/api
exec node dist/main.js
