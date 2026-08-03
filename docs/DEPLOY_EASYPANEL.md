# Deploy no EasyPanel — ABS Resolve / Bot WPP

Guia passo a passo em português para subir a plataforma no **EasyPanel** com **um serviço = um container**.

O arquivo `docker/docker-compose.yml` é só para **desenvolvimento local**. Em produção você **não** sobe o compose inteiro: cria cada serviço abaixo no painel EasyPanel.

**Banco de dados:** use o **Supabase** que você já tem no `.env` (recomendado). Não precisa criar Postgres no EasyPanel, a menos que queira (opcional).

---

## 1. Arquitetura (o que criar no EasyPanel)

| # | Serviço | Tipo | Imagem / Build | Porta | Domínio público |
|---|---------|------|----------------|------:|-----------------|
| 1 | `redis` | Imagem Docker | `redis:7-alpine` | 6379 (interna) | — |
| 2 | `evolution-api` | Imagem Docker | `evoapicloud/evolution-api:v2.3.7` | 8080 | `https://evo.SEUDOMINIO.com` |
| 3 | `api` | App Git / Dockerfile | `docker/Dockerfile.api` · context = **raiz do repo** | 3000 | `https://api.SEUDOMINIO.com` |
| 4 | `worker` | App Git / Dockerfile | `docker/Dockerfile.worker` · context = **raiz** | — | — (só rede interna) |
| 5 | `web` | App Git / Dockerfile | `docker/Dockerfile.web` · context = **raiz** | 80 | `https://app.SEUDOMINIO.com` |
| — | `postgres` | *(opcional)* | `pgvector/pgvector:pg16` | 5432 | — |

Todos os serviços devem ficar no **mesmo App/Projeto** EasyPanel (mesma rede interna) para se falarem por hostname: `redis`, `evolution-api`, `api`.

### Domínios sugeridos

| Domínio | Serviço |
|---------|---------|
| `app.SEUDOMINIO.com` | `web` |
| `api.SEUDOMINIO.com` | `api` |
| `evo.SEUDOMINIO.com` | `evolution-api` |

Substitua `SEUDOMINIO.com` pelo seu domínio real. No EasyPanel, ative HTTPS (Let's Encrypt) em cada domínio.

---

## 2. Ordem de deploy recomendada

Siga **nesta ordem** (dependências sobem primeiro):

1. **redis** — sobe em segundos; confirme health `PONG`.
2. **evolution-api** — precisa do Redis; configure domínio `evo.…` e volume.
3. **api** — precisa do Supabase + Redis + Evolution (hostname interno); rode e confira `/api/health`.
4. **worker** — mesmas envs de DB/Redis/Evolution da API (sem domínio).
5. **web** — build com URLs **públicas** da API; domínio `app.…`.
6. **Webhooks** — Evolution (automático via `PUBLIC_API_URL` / `EVOLUTION_WEBHOOK_URL`) + ASAAS no painel ASAAS.
7. **Testes** — login, QR WhatsApp, inbox, cobrança.

---

## 3. Passo a passo no EasyPanel (UI)

### 3.1 Criar o App / Projeto

1. Abra o EasyPanel → **Create Project** (ou use um existente).
2. Nome sugerido: `bot-wpp` ou `abs-resolve`.
3. Conecte o repositório GitHub: `GabrielBrandl/bot-wpp` (branch `master`).
4. Todos os serviços abaixo ficam **dentro deste mesmo projeto** (rede compartilhada).

### 3.2 Serviço `redis`

1. **+ Service** → **Docker Image**.
2. Image: `redis:7-alpine`.
3. Nome do serviço: `redis` (hostname interno = `redis`).
4. Porta: `6379` (não precisa expor na internet).
5. Volume (opcional, recomendado): mount `/data`.
6. Deploy → aguarde healthy.

**Env:** nenhuma obrigatória.

### 3.3 Serviço `evolution-api`

1. **+ Service** → **Docker Image**.
2. Image: `evoapicloud/evolution-api:v2.3.7`.
3. Nome: `evolution-api`.
4. Porta: `8080`.
5. Domínio: `evo.SEUDOMINIO.com` → porta `8080` + HTTPS.
6. Volume **obrigatório:** `/evolution/instances` (persiste sessões WhatsApp).
7. Cole as variáveis da seção **4.4** abaixo.
8. Deploy.

> `SERVER_URL` deve ser a URL **pública** HTTPS (`https://evo.SEUDOMINIO.com`), não o hostname interno.

### 3.4 Serviço `api`

1. **+ Service** → **App** (Git / Dockerfile).
2. Repositório: o mesmo `bot-wpp`.
3. **Dockerfile path:** `docker/Dockerfile.api`.
4. **Build context:** `.` (raiz do repositório) — **não** use a pasta `docker/` como context.
5. Nome: `api`.
6. Porta: `3000`.
7. Domínio: `api.SEUDOMINIO.com` → porta `3000` + HTTPS.
8. Healthcheck (se o painel pedir): HTTP `GET /api/health` na porta `3000`.
9. Cole as variáveis da seção **4.1**.
10. Deploy.

A imagem já executa no start:

```text
prisma migrate deploy  →  node dist/main.js
```

O processo escuta em `0.0.0.0:3000` (compatível com proxy do EasyPanel).

### 3.5 Serviço `worker`

1. **+ Service** → **App** (Dockerfile).
2. **Dockerfile path:** `docker/Dockerfile.worker`.
3. **Build context:** raiz (`.`).
4. Nome: `worker`.
5. **Sem domínio público.**
6. Cole as variáveis da seção **4.2**.
7. Deploy.

### 3.6 Serviço `web`

1. **+ Service** → **App** (Dockerfile).
2. **Dockerfile path:** `docker/Dockerfile.web`.
3. **Build context:** raiz (`.`).
4. Nome: `web`.
5. Porta: `80`.
6. Domínio: `app.SEUDOMINIO.com` → porta `80` + HTTPS.
7. **Build Arguments** (obrigatório — Vite embute no bundle):

| Build Arg | Valor |
|-----------|-------|
| `VITE_API_URL` | `https://api.SEUDOMINIO.com/api` |
| `VITE_WS_URL` | `https://api.SEUDOMINIO.com` |

8. Deploy. Se mudar o domínio da API depois, **rebuild** o `web`.

### 3.7 Seed inicial (uma vez)

Se o banco Supabase ainda estiver vazio (sem usuário admin), rode um **one-off** no serviço `api` ou localmente apontando para o Supabase:

```bash
pnpm --filter @bot-wpp/database seed
```

Login padrão do seed: `admin@absresolve.com` / `admin123` — **troque a senha imediatamente**.

As migrations já rodam automaticamente no start da `api`.

### 3.8 Webhooks públicos

Defina primeiro:

```text
PUBLIC_API_URL=https://api.SEUDOMINIO.com
```

| Integração | URL a usar |
|------------|------------|
| Evolution → API | `${PUBLIC_API_URL}/api/whatsapp/webhook` → `https://api.SEUDOMINIO.com/api/whatsapp/webhook` |
| ASAAS → API | `${PUBLIC_API_URL}/api/payments/webhook/asaas` → `https://api.SEUDOMINIO.com/api/payments/webhook/asaas` |

- **Evolution:** a API configura o webhook ao criar instância WhatsApp (usa `EVOLUTION_WEBHOOK_URL` ou deriva de `PUBLIC_API_URL`).
- **ASAAS:** no painel ASAAS → Integrações → Webhook → cole a URL acima (eventos de pagamento).

---

## 4. Variáveis de ambiente por serviço

Substitua `SEUDOMINIO.com`, senhas e chaves. **Nunca** commite `.env` com secrets.

### 4.1 `api`

```env
# --- Supabase (já conectado no seu .env local) ---
# Pooler Transaction (porta 6543) + SSL
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?schema=public&sslmode=require
# Direct (porta 5432) — obrigatório para prisma migrate
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require

# --- Redis (hostname do serviço EasyPanel) ---
REDIS_HOST=redis
REDIS_PORT=6379

# --- API ---
API_PORT=3000
API_PREFIX=api
JWT_SECRET=<gere-uma-string-longa-aleatoria>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://app.SEUDOMINIO.com

# URL pública da API (sem barra no final) — base dos webhooks
PUBLIC_API_URL=https://api.SEUDOMINIO.com

# Webhook Evolution (recomendado explicitar)
EVOLUTION_WEBHOOK_URL=https://api.SEUDOMINIO.com/api/whatsapp/webhook
EVOLUTION_WEBHOOK_SECRET=

# Evolution — hostname INTERNO (rede EasyPanel), NÃO o domínio público
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<mesma-chave-do-servico-evolution-api>

# IA (opcional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# ASAAS
ASAAS_API_URL=https://api.asaas.com/api/v3
ASAAS_API_KEY=
# Sandbox: ASAAS_API_URL=https://sandbox.asaas.com/api/v3
```

### 4.2 `worker`

```env
DATABASE_URL=<igual-à-api>
DIRECT_URL=<igual-à-api>
REDIS_HOST=redis
REDIS_PORT=6379
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<mesma-chave>
```

### 4.3 `web` (Build Arguments, não só runtime env)

```env
VITE_API_URL=https://api.SEUDOMINIO.com/api
VITE_WS_URL=https://api.SEUDOMINIO.com
```

No EasyPanel: campo **Build Arguments** / **Build Args**. Runtime env sozinho **não** atualiza o frontend Vite.

### 4.4 `evolution-api`

```env
SERVER_URL=https://evo.SEUDOMINIO.com
AUTHENTICATION_API_KEY=<mesma-chave-da-api>
# Redis compartilhado
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_LOCAL_ENABLED=false
QRCODE_LIMIT=30
LOG_LEVEL=ERROR,WARN,INFO
# DB próprio da Evolution (opcional):
# Com Supabase: crie um database/schema dedicado OU use outro projeto.
# Sem DB próprio:
DATABASE_ENABLED=false
# Com Postgres próprio (se criar postgres no EasyPanel):
# DATABASE_ENABLED=true
# DATABASE_PROVIDER=postgresql
# DATABASE_CONNECTION_URI=postgresql://postgres:SENHA@postgres:5432/evolution?schema=public
```

**Volume:** `/evolution/instances`.

### 4.5 `redis`

Sem variáveis obrigatórias.

### 4.6 `postgres` (opcional — só se NÃO usar Supabase)

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<forte>
POSTGRES_DB=bot_wpp
```

Nesse caso, na `api` / `worker`:

```env
DATABASE_URL=postgresql://postgres:SENHA@postgres:5432/bot_wpp?schema=public
DIRECT_URL=postgresql://postgres:SENHA@postgres:5432/bot_wpp?schema=public
```

Crie também o database `evolution` se a Evolution usar Postgres:

```sql
CREATE DATABASE evolution;
```

---

## 5. Supabase — connection strings

1. Supabase → **Project Settings** → **Database**.
2. **Connection string → Transaction pooler (porta 6543)** → cole em `DATABASE_URL`. Acrescente `?schema=public&sslmode=require` (ou `&sslmode=require` se já houver `?`).
3. **Direct connection (db.*.supabase.co:5432)** → cole em `DIRECT_URL` com `?sslmode=require`.
4. A API no start usa `DIRECT_URL` via Prisma (`migrate deploy`).

Exemplo:

```env
DATABASE_URL=postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?schema=public&sslmode=require
DIRECT_URL=postgresql://postgres:SENHA@db.xxxx.supabase.co:5432/postgres?sslmode=require
```

---

## 6. Healthchecks sugeridos

| Serviço | Tipo | Target |
|---------|------|--------|
| `api` | HTTP | `http://127.0.0.1:3000/api/health` |
| `web` | HTTP | `http://127.0.0.1/healthz` |
| `redis` | comando | `redis-cli ping` |
| `evolution-api` | TCP/HTTP | porta `8080` |
| `postgres` *(opc.)* | comando | `pg_isready -U postgres -d bot_wpp` |

---

## 7. Checklist pré-go-live (marque na UI)

- [ ] Projeto EasyPanel criado; GitHub conectado
- [ ] `redis` saudável; `REDIS_HOST=redis` / `REDIS_PORT=6379`
- [ ] Supabase: `DATABASE_URL` + `DIRECT_URL` com `sslmode=require`
- [ ] `JWT_SECRET` forte; `EVOLUTION_API_KEY` igual na `api`, `worker` e `evolution-api`
- [ ] `CORS_ORIGIN=https://app.SEUDOMINIO.com`
- [ ] `PUBLIC_API_URL=https://api.SEUDOMINIO.com`
- [ ] `EVOLUTION_WEBHOOK_URL=https://api.SEUDOMINIO.com/api/whatsapp/webhook` (público HTTPS)
- [ ] `EVOLUTION_API_URL=http://evolution-api:8080` (interno)
- [ ] `SERVER_URL=https://evo.SEUDOMINIO.com` (público)
- [ ] Volume Evolution `/evolution/instances`
- [ ] Web: build args `VITE_API_URL` e `VITE_WS_URL` públicos
- [ ] Domínios HTTPS: `app.`, `api.`, `evo.`
- [ ] ASAAS webhook → `https://api.SEUDOMINIO.com/api/payments/webhook/asaas`
- [ ] Seed/admin com senha trocada
- [ ] Dockerfile context = raiz do repo (não `docker/`)

---

## 8. Como testar depois de subir

1. **API viva:** abra `https://api.SEUDOMINIO.com/api/health` → deve retornar OK/JSON saudável.
2. **Frontend:** abra `https://app.SEUDOMINIO.com` → tela de login.
3. **Login** com o usuário seed (ou o que você criou).
4. **Settings → WhatsApp:** criar instância → escanear QR → status conectado.
5. Envie uma mensagem no WhatsApp → deve aparecer no **Inbox**.
6. Teste **Automações**, **Kanban**, **Pagamentos** (link ASAAS / webhook).
7. Se o frontend chamar `localhost`: o `web` foi buildado sem os Build Args corretos → rebuild.

---

## 9. Local vs produção

| Variável | Local (dev) | EasyPanel |
|----------|-------------|-----------|
| `DATABASE_URL` | `127.0.0.1:5433` | Supabase pooler |
| `REDIS_HOST` | `127.0.0.1` (porta host `6380`) | `redis` / `6379` |
| `EVOLUTION_API_URL` | `http://localhost:8080` | `http://evolution-api:8080` |
| `PUBLIC_API_URL` | — | `https://api.SEUDOMINIO.com` |
| `EVOLUTION_WEBHOOK_URL` | `http://host.docker.internal:3000/...` | `${PUBLIC_API_URL}/api/whatsapp/webhook` |
| `CORS_ORIGIN` | `http://localhost:5173` | `https://app.SEUDOMINIO.com` |
| `VITE_API_URL` | `http://localhost:3000/api` | `https://api.SEUDOMINIO.com/api` |

---

## 10. Troubleshooting rápido

| Sintoma | Causa comum | Ação |
|---------|-------------|------|
| API reinicia em loop | `DATABASE_URL`/`DIRECT_URL` inválidos | Conferir SSL, senha, pooler vs direct |
| Healthcheck falha | porta/path errados | Usar `/api/health` na porta `3000` |
| Frontend sem dados | Build args errados | Rebuild `web` com `VITE_*` públicos |
| WhatsApp sem mensagem | webhook localhost | `PUBLIC_API_URL` / `EVOLUTION_WEBHOOK_URL` HTTPS |
| Evolution não fala com API | URL interna errada | `EVOLUTION_API_URL=http://evolution-api:8080` |
| CORS bloqueado | origem diferente | `CORS_ORIGIN` = URL exata do `web` |

---

## Referência de arquivos no repo

| Arquivo | Uso |
|---------|-----|
| `docker/Dockerfile.api` | Build + migrate no start + `node` |
| `docker/api-entrypoint.sh` | `prisma migrate deploy` → start |
| `docker/Dockerfile.worker` | Worker BullMQ |
| `docker/Dockerfile.web` | Nginx + SPA Vite |
| `docker/nginx.conf` | `/healthz` + SPA fallback |
| `docker/docker-compose.yml` | **Somente local** |
| `.env.example` | Modelo de variáveis (sem secrets) |
