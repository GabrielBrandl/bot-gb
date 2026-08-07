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

# Seed also runs from Nest AutoSeedService when RUN_SEED=true and DB is empty.
if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[api] Pre-start seed attempt..."
  TSX_BIN=""
  if [ -x /app/node_modules/.bin/tsx ]; then TSX_BIN=/app/node_modules/.bin/tsx; fi
  if [ -z "$TSX_BIN" ] && [ -x /app/packages/database/node_modules/.bin/tsx ]; then
    TSX_BIN=/app/packages/database/node_modules/.bin/tsx
  fi
  if [ -n "$TSX_BIN" ]; then
    "$TSX_BIN" prisma/seed.ts && echo "[api] seed completed" || echo "[api] seed FAILED (Nest will retry if DB empty)"
  else
    echo "[api] tsx binary not found — Nest AutoSeedService will try"
  fi
fi

echo "[api] Starting NestJS..."
cd /app/apps/api
exec node dist/main.js
