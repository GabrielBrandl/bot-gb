# Deploy no EasyPanel — ABS Resolve / Bot WPP

Guia completo para subir a plataforma como **serviços separados** no EasyPanel (recomendado). O `docker/docker-compose.yml` serve para desenvolvimento local; em produção cada serviço abaixo vira um app EasyPanel.

## Arquitetura

| Serviço EasyPanel | Build / Imagem | Porta pública | Healthcheck |
|-------------------|----------------|--------------:|-------------|
| `postgres` *(opcional)* | `pgvector/pgvector:pg16` | interno 5432 | `pg_isready -U postgres -d bot_wpp` |
| `redis` | `redis:7-alpine` | interno 6379 | `redis-cli ping` |
| `evolution-api` | `evoapicloud/evolution-api:v2.3.7` | **8080** (ou domínio `evo.`) | `GET /` ou porta 8080 |
| `api` | Dockerfile: `docker/Dockerfile.api` · context: raiz do repo | **3000** | `GET /api/health` |
| `worker` | Dockerfile: `docker/Dockerfile.worker` · context: raiz | — | processo Node ativo |
| `web` | Dockerfile: `docker/Dockerfile.web` · context: raiz | **80** | `GET /` |

**Banco:** use **Supabase** (recomendado) **ou** o serviço `postgres` no EasyPanel. Nunca os dois como fonte de verdade.

### Domínios sugeridos

| Domínio | Aponta para |
|---------|-------------|
| `app.seudominio.com` | `web` |
| `api.seudominio.com` | `api` |
| `evo.seudominio.com` | `evolution-api` |

Todos os serviços devem estar na **mesma rede interna** do projeto EasyPanel para se comunicarem por hostname (`redis`, `evolution-api`, `api`, `postgres`).

---

## Passo a passo EasyPanel

1. Conecte o repositório GitHub `bot-wpp` ao EasyPanel.
2. Crie o serviço **redis** (imagem `redis:7-alpine`, volume opcional `/data`).
3. Crie o banco:
   - **Opção A — Supabase:** copie Connection string (pooler + direct) com `sslmode=require` (veja abaixo).
   - **Opção B — Postgres EasyPanel:** imagem `pgvector/pgvector:pg16`, env `POSTGRES_*`, volume em `/var/lib/postgresql/data`. Se usar Evolution com DB próprio, crie também o database `evolution`.
4. Crie **evolution-api** (imagem oficial), domínio público `evo.…`, volume `/evolution/instances`.
5. Crie **api** (Dockerfile.api), domínio `api.…`, healthcheck `/api/health`.
6. Crie **worker** (Dockerfile.worker) — sem domínio público.
7. Crie **web** (Dockerfile.web) com **build args** `VITE_API_URL` / `VITE_WS_URL` apontando para a API **pública**.
8. Rode migrate + seed (one-off) na API ou localmente contra o banco de produção.
9. Configure webhooks públicos Evolution + ASAAS.
10. Crie instância WhatsApp no painel Settings e escaneie o QR.

---

## Variáveis de ambiente

### `api`

```env
# Supabase (produção) — Transaction pooler + SSL
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?schema=public&sslmode=require
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require

# OU Postgres interno EasyPanel:
# DATABASE_URL=postgresql://postgres:SENHA@postgres:5432/bot_wpp?schema=public
# DIRECT_URL=postgresql://postgres:SENHA@postgres:5432/bot_wpp?schema=public

REDIS_HOST=redis
REDIS_PORT=6379
API_PORT=3000
API_PREFIX=api
JWT_SECRET=<string-longa-aleatoria>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://app.seudominio.com

# Hostname interno do serviço Evolution no EasyPanel
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<mesma-chave-da-evolution>

# URL PÚBLICA da API — Evolution (container) chama de volta
EVOLUTION_WEBHOOK_URL=https://api.seudominio.com/api/whatsapp/webhook
EVOLUTION_WEBHOOK_SECRET=

OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Produção ASAAS (ou sandbox)
ASAAS_API_URL=https://api.asaas.com/api/v3
ASAAS_API_KEY=
# Sandbox: ASAAS_API_URL=https://sandbox.asaas.com/api/v3
```

**Webhooks públicos (obrigatórios em produção):**

| Integração | URL |
|------------|-----|
| Evolution → API | `https://api.seudominio.com/api/whatsapp/webhook` |
| ASAAS → API | `https://api.seudominio.com/api/payments/webhook/asaas` |

Configure o webhook ASAAS no painel ASAAS → Integrações → Webhook.

> Em **local** (Docker Desktop), use `EVOLUTION_WEBHOOK_URL=http://host.docker.internal:3000/api/whatsapp/webhook`. No EasyPanel use sempre o domínio HTTPS público da API.

### `worker`

```env
DATABASE_URL=<igual-à-api>
DIRECT_URL=<igual-à-api-se-Supabase>
REDIS_HOST=redis
REDIS_PORT=6379
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<mesma-chave>
```

### `web` (build args — bake no build Vite)

```env
VITE_API_URL=https://api.seudominio.com/api
VITE_WS_URL=https://api.seudominio.com
```

No EasyPanel: **Build Arguments** (não apenas runtime env), porque o Vite embute essas URLs no bundle.

Dockerfile: `docker/Dockerfile.web`  
Context: raiz do repositório  
Porta: `80`

### `evolution-api`

```env
SERVER_URL=https://evo.seudominio.com
AUTHENTICATION_API_KEY=<mesma-chave-da-api>
# Com Postgres EasyPanel / Supabase dedicado:
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://postgres:SENHA@postgres:5432/evolution?schema=public
# Ou desligar DB próprio e usar só Redis:
# DATABASE_ENABLED=false
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_LOCAL_ENABLED=false
QRCODE_LIMIT=30
LOG_LEVEL=ERROR,WARN,INFO
```

**Volume:** `/evolution/instances` (persistir sessões WhatsApp).

### `postgres` (se não usar Supabase)

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<forte>
POSTGRES_DB=bot_wpp
```

Crie o database `evolution` se a Evolution API usar Postgres:

```sql
CREATE DATABASE evolution;
```

`DATABASE_URL` da API/worker:

`postgresql://postgres:<forte>@postgres:5432/bot_wpp?schema=public`

### `redis`

Sem env obrigatório. Volume opcional: `/data`.

---

## Supabase — connection strings

1. Supabase → Project Settings → Database.
2. **Pooler (Transaction, porta 6543)** → `DATABASE_URL` da API/worker. Acrescente `&sslmode=require`.
3. **Direct (db.*.supabase.co:5432)** → `DIRECT_URL` para `prisma migrate`. Acrescente `?sslmode=require`.
4. Prisma no monorepo já usa `DATABASE_URL` + `DIRECT_URL` em `packages/database`.

Exemplo:

```env
DATABASE_URL=postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?schema=public&sslmode=require
DIRECT_URL=postgresql://postgres:SENHA@db.xxxx.supabase.co:5432/postgres?sslmode=require
```

---

## Migrations no deploy

**One-off** no EasyPanel (serviço api, comando):

```bash
pnpm --filter @bot-wpp/database generate
pnpm --filter @bot-wpp/database migrate:deploy
# opcional, só ambiente novo:
pnpm --filter @bot-wpp/database seed
```

Ou rode localmente apontando `DATABASE_URL`/`DIRECT_URL` para produção.

Login seed ABS Resolve: `admin@absresolve.com` / `admin123` — **troque a senha em produção**.

---

## Healthchecks sugeridos (EasyPanel)

| Serviço | Tipo | Target |
|---------|------|--------|
| `api` | HTTP | `http://localhost:3000/api/health` |
| `web` | HTTP | `http://localhost:80/` |
| `redis` | TCP / comando | `redis-cli ping` |
| `postgres` | comando | `pg_isready -U postgres -d bot_wpp` |
| `evolution-api` | TCP / HTTP | porta `8080` |

---

## Checklist pré-go-live

- [ ] Redis saudável; `REDIS_HOST=redis` (hostname do serviço EasyPanel)
- [ ] `JWT_SECRET` e `EVOLUTION_API_KEY` fortes e iguais onde necessário
- [ ] `CORS_ORIGIN` = URL HTTPS do frontend
- [ ] `EVOLUTION_WEBHOOK_URL` = URL **pública** HTTPS da API (não localhost)
- [ ] `EVOLUTION_API_URL` = hostname **interno** (`http://evolution-api:8080`)
- [ ] `SERVER_URL` da Evolution = domínio público `https://evo.…`
- [ ] Web build args `VITE_API_URL` / `VITE_WS_URL` com domínio público da API
- [ ] Supabase: `sslmode=require` + `DIRECT_URL` para migrate
- [ ] ASAAS webhook → `https://api.…/api/payments/webhook/asaas`
- [ ] Volume Evolution `/evolution/instances` persistente
- [ ] Seed/admin com senha trocada
- [ ] Teste: Settings → criar instância → QR → conectar WhatsApp
- [ ] Teste: Inbox, Automações/editor, Pagamentos, Kanban

---

## Local vs produção (sem hardcode)

| Variável | Local (dev) | EasyPanel |
|----------|-------------|-----------|
| `DATABASE_URL` | `127.0.0.1:5433` | Supabase pooler ou `postgres:5432` |
| `REDIS_HOST` | `127.0.0.1` / porta `6380` | `redis` / `6379` |
| `EVOLUTION_API_URL` | `http://localhost:8080` | `http://evolution-api:8080` |
| `EVOLUTION_WEBHOOK_URL` | `http://host.docker.internal:3000/...` | `https://api.domínio/...` |
| `CORS_ORIGIN` | `http://localhost:5173` | `https://app.domínio` |
| `VITE_API_URL` | `http://localhost:3000/api` | `https://api.domínio/api` |

Defaults `localhost` no código existem só para DX local; produção **sempre** sobrescreve via env / build args.
