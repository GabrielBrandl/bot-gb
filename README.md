# ABS Resolve — Atendimento, Automação e CRM para WhatsApp

Plataforma multi-tenant (pnpm + Turborepo) com inbox WhatsApp, automações estilo n8n, agente de IA, Kanban, campanhas e pagamentos ASAAS.

Identidade visual: **ABS Resolve** (azul `#0033B5` + amarelo `#F7C400`).

## Stack

| Serviço | Tecnologia |
|---------|------------|
| `apps/api` | NestJS + JWT + Socket.io |
| `apps/worker` | BullMQ |
| `apps/web` | React + Vite + Tailwind |
| `packages/database` | Prisma / PostgreSQL |
| WhatsApp | Evolution API (`evoapicloud/evolution-api`) |
| Cache/filas | Redis |
| Deploy | Docker / EasyPanel |
| DB produção | Supabase (ou Postgres no EasyPanel) |

## Setup local com Docker

Pré-requisitos: Node 20+, pnpm 9, Docker Desktop.

**Portas locais do compose:** Postgres `5433`, Redis `6380` (evita conflito com Postgres/Redis do Windows em 5432/6379).

```bash
pnpm install
cp .env.example .env

# Infra
docker compose -f docker/docker-compose.yml up -d postgres redis evolution-api

# Schema + seed
pnpm db:generate
pnpm db:push   # ou: pnpm db:migrate
pnpm db:seed

# Apps (dev)
pnpm --filter @bot-wpp/api dev
pnpm --filter @bot-wpp/web dev
```

### Acessos seed

- Frontend: http://localhost:5173  
- API: http://localhost:3000/api  
- Evolution: http://localhost:8080  
- Login: `admin@absresolve.com` / `admin123`  
  (também `admin@demo.com` / `admin123`)

### Portas

| Porta | Serviço |
|------:|---------|
| 5173 | Web |
| 3000 | API |
| 5433 | Postgres (Docker → 5432 interno) |
| 6380 | Redis (Docker → 6379 interno) |
| 8080 | Evolution API |

## Supabase (produção)

1. Crie um projeto no Supabase.
2. Em **Project Settings → Database**, copie:
   - **Connection pooling (Transaction)** → `DATABASE_URL` (porta `6543`)
   - **Direct connection** → `DIRECT_URL` (porta `5432`)
3. Acrescente `&sslmode=require` nas duas URLs.
4. Rode migrations com a URL direta:

```bash
# .env (exemplo)
DATABASE_URL=postgresql://postgres.xxxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?schema=public&sslmode=require
DIRECT_URL=postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres?sslmode=require

pnpm db:migrate
# ou em deploy: pnpm --filter @bot-wpp/database migrate:deploy
```

Prisma já está configurado com `url` + `directUrl` no schema.

## EasyPanel

Veja o guia completo em [`docs/DEPLOY_EASYPANEL.md`](docs/DEPLOY_EASYPANEL.md).

Resumo: um app/serviço por container (`api`, `worker`, `web`, `redis`, `evolution-api`). Banco pode ser **Supabase** ou um serviço Postgres no próprio EasyPanel. Configure as variáveis do `.env.example` no painel de cada serviço.

## Scripts úteis

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:seed
pnpm --filter @bot-wpp/api test
docker compose -f docker/docker-compose.yml ps
```
