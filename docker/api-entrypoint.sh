#!/bin/sh
set -e

echo "[api] Running Prisma migrations..."
cd /app/packages/database
pnpm exec prisma migrate deploy

echo "[api] Starting NestJS..."
cd /app/apps/api
exec node dist/main.js
