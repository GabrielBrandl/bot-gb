# Deploy no EasyPanel — ABS Resolve / Bot WPP

Guia passo a passo em português para subir a plataforma no **EasyPanel**.

**Arquivo Compose (recomendado):** no EasyPanel, campo **"Arquivo Docker Compose"**, use:

```text
docker/docker-compose.easypanel.yml
```

Esse arquivo **não** tem `container_name` nem mapeamento de `ports:` no host — evita os avisos de conflito do EasyPanel. Domínios e portas públicas são atribuídos pelo painel. Serviços se falam pelo nome (`redis`, `api`, `evolution-api`, etc.).

| Compose | Uso |
|---------|-----|
| `docker/docker-compose.easypanel.yml` | **Produção EasyPanel** (sem `ports` / sem `container_name`) |
| `docker/docker-compose.yml` | **Somente local** (portas no host: 3000, 5173, 6380, 8080, 5433) |

**Banco de dados:** use o **Supabase** (recomendado). O Postgres do compose EasyPanel fica atrás do profile `with-postgres` e **não sobe por padrão**.

---

## 1. O que colocar no formulário EasyPanel

1. Conecte o repositório GitHub: `GabrielBrandl/bot-wpp` (branch `master`).
2. Campo **Arquivo Docker Compose** → `docker/docker-compose.easypanel.yml`
3. Salve / faça deploy — os avisos de `container_name` e `ports` devem sumir.
4. Configure **domínios** nos serviços públicos (`web`, `api`, `evolution-api`) apontando para as portas internas abaixo.
5. Cole as variáveis de ambiente da seção **4** (Supabase, JWT, Evolution, etc.).

### Portas internas (EasyPanel mapeia domínio → porta do container)

| Serviço | Porta interna | Domínio sugerido |
|---------|--------------:|------------------|
| `redis` | 6379 | — (só rede interna) |
| `evolution-api` | 8080 | `https://evo.SEUDOMINIO.com` |
| `api` | 3000 | `https://api.SEUDOMINIO.com` |
| `worker` | — | — (só rede interna) |
| `web` | 80 | `https://app.SEUDOMINIO.com` |
| `postgres` | 5432 | — (opcional, profile `with-postgres`) |

Todos os serviços do mesmo App/Projeto EasyPanel compartilham a rede e se resolvem por hostname.

### Domínios sugeridos

| Domínio | Serviço |
|---------|---------|
| `app.SEUDOMINIO.com` | `web` |
| `api.SEUDOMINIO.com` | `api` |
| `evo.SEUDOMINIO.com` | `evolution-api` |

Substitua `SEUDOMINIO.com` pelo seu domínio real. Ative HTTPS (Let's Encrypt) em cada domínio.

---

## 2. Ordem de deploy / verificação

1. Cole o path do compose → salve (warnings de `ports`/`container_name` devem desaparecer).
2. Defina envs (seção 4) — especialmente `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `EVOLUTION_API_KEY`.
3. Domínios: `app.`, `api.`, `evo.` nas portas internas corretas.
4. Deploy → confira `https://api.SEUDOMINIO.com/api/health`.
5. Build args do `web`: `VITE_API_URL` e `VITE_WS_URL` públicos.
6. Webhooks Evolution + ASAAS (seção 3.8).
7. Testes: login, QR WhatsApp, inbox, cobrança.

---

## 3. Passo a passo no EasyPanel (UI)

### 3.1 Criar o App / Projeto com Compose

1. Abra o EasyPanel → **Create Project** (ou use um existente).
2. Nome sugerido: `bot-wpp` ou `abs-resolve`.
3. Conecte o repositório GitHub: `GabrielBrandl/bot-wpp` (branch `master`).
4. Em **Arquivo Docker Compose**, informe:

```text
docker/docker-compose.easypanel.yml
```

5. Salve. Os serviços `redis`, `evolution-api`, `api`, `worker`, `web` aparecem a partir do compose.
6. **Não** use `docker/docker-compose.yml` (local) no EasyPanel — ele tem `ports` e `container_name` e gera avisos/conflitos.

### 3.2 Domínios e volumes

| Serviço | Domínio | Porta no painel | Volume |
|---------|---------|----------------:|--------|
| `web` | `app.SEUDOMINIO.com` | 80 | — |
| `api` | `api.SEUDOMINIO.com` | 3000 | — |
| `evolution-api` | `evo.SEUDOMINIO.com` | 8080 | `/evolution/instances` (obrigatório) |
| `redis` | — | 6379 (interna) | `/data` (recomendado; já no compose) |
| `worker` | — | — | — |

> `SERVER_URL` da Evolution deve ser a URL **pública** HTTPS (`https://evo.SEUDOMINIO.com`), não o hostname interno.

### 3.3 Healthcheck da API

Se o painel pedir: HTTP `GET /api/health` na porta `3000`.

A imagem da API já executa no start:

```text
prisma migrate deploy  →  node dist/main.js
```

O processo escuta em `0.0.0.0:3000` (compatível com proxy do EasyPanel).

### 3.4 Build Arguments do `web`

No serviço `web` (Build Arguments — Vite embute no bundle):

| Build Arg | Valor |
|-----------|-------|
| `VITE_API_URL` | `https://api.SEUDOMINIO.com/api` |
| `VITE_WS_URL` | `https://api.SEUDOMINIO.com` |

Se mudar o domínio da API depois, **rebuild** o `web`. Runtime env sozinho **não** atualiza o frontend Vite.

### 3.5 Seed inicial (uma vez)

Se o banco Supabase ainda estiver vazio (sem usuário admin), rode um **one-off** no serviço `api` ou localmente apontando para o Supabase:

```bash
pnpm --filter @bot-wpp/database seed
```

Login padrão do seed: `admin@absresolve.com` / `admin123` — **troque a senha imediatamente**.

As migrations já rodam automaticamente no start da `api`.

### 3.6 Webhooks públicos

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

### 3.7 Alternativa: um serviço por vez (sem compose)

Se preferir criar serviço a serviço no EasyPanel (sem o arquivo compose), use as mesmas imagens/Dockerfiles e envs deste guia. O compose EasyPanel é o caminho mais simples para evitar conflitos de `ports`/`container_name`.

---

## 4. Variáveis de ambiente por serviço

Substitua `SEUDOMINIO.com`, senhas e chaves. **Nunca** commite `.env` com secrets. No EasyPanel, defina as envs no painel (ou env do projeto); o compose referencia `${DATABASE_URL}`, `${JWT_SECRET}`, etc.

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

No EasyPanel: campo **Build Arguments** / **Build Args**.

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
# Com Postgres próprio (profile with-postgres):
# DATABASE_ENABLED=true
# DATABASE_PROVIDER=postgresql
# DATABASE_CONNECTION_URI=postgresql://postgres:SENHA@postgres:5432/evolution?schema=public
```

**Volume:** `/evolution/instances`.

### 4.5 `redis`

Sem variáveis obrigatórias.

### 4.6 `postgres` (opcional — profile `with-postgres`)

Só se **não** usar Supabase. No EasyPanel, ative o profile `with-postgres` se o painel permitir; ou ignore este serviço.

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

- [ ] Projeto EasyPanel; GitHub conectado; compose = `docker/docker-compose.easypanel.yml`
- [ ] Sem avisos de `container_name` / `ports` após salvar
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
- [ ] Dockerfile context = raiz do repo (já no compose)

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
| Compose | `docker/docker-compose.yml` | `docker/docker-compose.easypanel.yml` |
| `ports` / `container_name` | sim (host bind) | **não** (EasyPanel gerencia) |
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
| Aviso `ports` / `container_name` | Compose local no EasyPanel | Trocar para `docker/docker-compose.easypanel.yml` e salvar/redeploy |
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
| `docker/docker-compose.easypanel.yml` | **Produção EasyPanel** (sem ports/container_name) |
| `docker/docker-compose.yml` | **Somente local** (com ports no host) |
| `docker/Dockerfile.api` | Build + migrate no start + `node` |
| `docker/api-entrypoint.sh` | `prisma migrate deploy` → start |
| `docker/Dockerfile.worker` | Worker BullMQ |
| `docker/Dockerfile.web` | Nginx + SPA Vite |
| `docker/nginx.conf` | `/healthz` + SPA fallback |
| `.env.example` | Modelo de variáveis (sem secrets) |
