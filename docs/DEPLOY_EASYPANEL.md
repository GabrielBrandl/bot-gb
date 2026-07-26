# Deploy no EasyPanel — ABS Resolve / Bot WPP

## Arquitetura recomendada

Crie **um serviço por container** no mesmo projeto EasyPanel:

| Serviço EasyPanel | Imagem / Build | Porta |
|-------------------|----------------|------:|
| `postgres` (opcional) | `pgvector/pgvector:pg16` | 5432 (interno) |
| `redis` | `redis:7-alpine` | 6379 (interno) |
| `evolution-api` | `evoapicloud/evolution-api:v2.3.7` (ou `latest`) | 8080 |
| `api` | Dockerfile `docker/Dockerfile.api` | 3000 |
| `worker` | Dockerfile `docker/Dockerfile.worker` | — |
| `web` | Dockerfile `docker/Dockerfile.web` | 80 |

**Banco:** use **Supabase** (recomendado) **ou** Postgres no EasyPanel. Não rode os dois como fonte de verdade.

Domínios sugeridos:

- `app.seudominio.com` → `web`
- `api.seudominio.com` → `api`
- `evo.seudominio.com` → `evolution-api` (ou rede interna)

## Variáveis de ambiente

### `api`

```
DATABASE_URL=...                    # Supabase pooler ou postgres:5432 interno
DIRECT_URL=...                      # só se precisar migrate no container
REDIS_HOST=redis                    # nome do serviço Redis no EasyPanel
REDIS_PORT=6379
API_PORT=3000
API_PREFIX=api
JWT_SECRET=<string-longa-aleatoria>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://app.seudominio.com
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<mesma-chave-da-evolution>
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
ASAAS_API_URL=https://api.asaas.com/api/v3
ASAAS_API_KEY=
```

Webhook público Evolution → API:

`https://api.seudominio.com/api/whatsapp/webhook`

Webhook ASAAS:

`https://api.seudominio.com/api/payments/webhook/asaas`

### `worker`

```
DATABASE_URL=...
REDIS_HOST=redis
REDIS_PORT=6379
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=...
```

### `web` (build args / env de build)

```
VITE_API_URL=https://api.seudominio.com/api
VITE_WS_URL=https://api.seudominio.com
```

### `evolution-api`

```
SERVER_URL=https://evo.seudominio.com
AUTHENTICATION_API_KEY=<mesma-chave>
DATABASE_ENABLED=false
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379
CACHE_REDIS_PREFIX_KEY=evolution
QRCODE_LIMIT=30
```

### `postgres` (se não usar Supabase)

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<forte>
POSTGRES_DB=bot_wpp
```

`DATABASE_URL` da API/worker:

`postgresql://postgres:<forte>@postgres:5432/bot_wpp?schema=public`

## Migrations no deploy

Opções:

1. **One-off** no EasyPanel (job/command):  
   `pnpm --filter @bot-wpp/database migrate:deploy`
2. Ou rode localmente apontando `DATABASE_URL`/`DIRECT_URL` para o banco de produção (Supabase direct).

Depois: `pnpm db:seed` só em ambiente novo (opcional).

## Checklist

- [ ] Redis saudável e acessível pela API/worker
- [ ] `JWT_SECRET` e `EVOLUTION_API_KEY` fortes e iguais onde necessário
- [ ] `CORS_ORIGIN` = URL do frontend
- [ ] Webhook Evolution apontando para a API pública
- [ ] Supabase: `sslmode=require` + `DIRECT_URL` para migrate
- [ ] ASAAS webhook configurado no painel ASAAS
