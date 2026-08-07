# Deploy no EasyPanel — GB Systems / bot-gb

Stack pronta: **postgres + redis + evolution-api + api + worker + web**.

Arquivos:
- Compose: [`docker-compose.easypanel.yml`](../docker-compose.easypanel.yml) (use este na **raiz**)
- Env template: [`.env.easypanel.example`](../.env.easypanel.example)

---

## 1. Domínios no EasyPanel

Crie 3 domínios HTTPS (Let's Encrypt):

| Serviço compose | Domínio exemplo | Porta interna | Observação |
|-----------------|-----------------|---------------|------------|
| `web` | `https://app.seudominio.com` | `80` | Frontend |
| `api` | `https://api.seudominio.com` | `3000` | **WebSocket ligado** (Socket.io) |
| `evolution-api` | `https://evo.seudominio.com` | `8080` | Painel/API WhatsApp |

Não exponha `postgres`, `redis` nem `worker` na internet.

---

## 2. Variáveis de ambiente

1. Copie `.env.easypanel.example`
2. Troque `SEUDOMINIO`, senhas e secrets
3. Cole no Environment do projeto EasyPanel (createDotEnv)

Checklist mínimo:

- [ ] `POSTGRES_PASSWORD` forte
- [ ] `DATABASE_URL` / `DIRECT_URL` / `EVOLUTION_DATABASE_URI`
- [ ] `JWT_SECRET` (≥ 32 chars)
- [ ] `EVOLUTION_API_KEY` + `EVOLUTION_WEBHOOK_SECRET`
- [ ] `CORS_ORIGIN` = URL do `web`
- [ ] `PUBLIC_API_URL` = URL do `api`
- [ ] `EVOLUTION_SERVER_URL` = URL pública do `evolution-api`
- [ ] `EVOLUTION_WEBHOOK_URL` = `https://api…/api/whatsapp/webhook`
- [ ] `VITE_API_URL` = `https://api…/api`
- [ ] `VITE_WS_URL` = `https://api…`

Sem `EVOLUTION_WEBHOOK_SECRET` o webhook WhatsApp é rejeitado em produção.

---

## 3. Deploy no EasyPanel

1. Conecte o repositório Git (ou faça upload)
2. Compose path: **`docker-compose.easypanel.yml`**
3. Aplique as envs
4. Build / Deploy
5. Aguarde healthchecks (`api` sobe migrations Prisma no entrypoint)

### Rebuild do frontend

`VITE_*` entram no **build**. Se mudar domínio da API, force rebuild do serviço `web`.

---

## 4. Pós-deploy

```bash
# Dentro do container api (ou via EasyPanel terminal), se precisar seed:
pnpm --filter @bot-wpp/database db:seed
```

Logins seed (troque imediatamente):

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Super Admin | `admin@gbsystems.com.br` | `admin123` |
| Tenant demo | `admin@demo.gbsystems.com.br` | `admin123` |

Healthchecks:

- API: `GET https://api.seudominio.com/api/health`
- Web: `GET https://app.seudominio.com/healthz`
- Evolution: `GET https://evo.seudominio.com`

---

## 5. Webhooks externos

| Origem | URL |
|--------|-----|
| Evolution (WhatsApp) | `https://api.seudominio.com/api/whatsapp/webhook` |
| ASAAS | `https://api.seudominio.com/api/payments/webhook/asaas` |
| Instagram (Meta) | `https://api.seudominio.com/api/instagram/webhook` |

A API configura o webhook da Evolution automaticamente ao criar/conectar instância (header `x-webhook-secret`).

---

## 6. WhatsApp (QR / código)

1. Confirme Evolution online no domínio `evo.`
2. No painel (`app.`): Configurações → WhatsApp
3. QR ou código de pareamento (número com DDD; +55/9 ajustados automaticamente)
4. Status deve ir para **Conectado** (webhook + polling)

Se o código for rejeitado pelo app: gere de novo e digite em até ~1 minuto; confira o número exibido na tela.

---

## 7. Supabase em vez do Postgres do compose

1. Crie banco `bot_wpp` + `evolution` no Supabase (ou um DB com dois schemas/databases)
2. Ajuste `DATABASE_URL`, `DIRECT_URL`, `EVOLUTION_DATABASE_URI` com `sslmode=require`
3. Remova/desabilite o serviço `postgres` no EasyPanel para não gastar recurso

---

## 8. Troubleshooting

| Sintoma | Causa comum |
|---------|-------------|
| Web chama `localhost` | `VITE_*` não setados no build → rebuild `web` |
| CORS bloqueado | `CORS_ORIGIN` ≠ URL real do `web` |
| Webhook 401 | `EVOLUTION_WEBHOOK_SECRET` ausente/diferente |
| Evolution não sobe | `EVOLUTION_DATABASE_URI` / senha Postgres errada |
| Socket offline | WebSocket desligado no proxy do domínio `api` |
| JWT rejeitado | `JWT_SECRET` curto ou default com `PUBLIC_API_URL` setado |
