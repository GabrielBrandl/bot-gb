# GB Systems — Omnichannel Platform

Plataforma multi-tenant (pnpm + Turborepo) para atendimento **WhatsApp + Instagram**, automações, agente de IA, Kanban CRM, campanhas e pagamentos ASAAS.

Identidade visual: **GB Systems** (azul `#2F6BFF` + roxo `#8B5CF6`, tema dark).

## Planos comerciais

| Plano | Preço | Destaques |
|-------|------:|-----------|
| **Starter** | R$ 97/mês | 1 WhatsApp, 2 agentes, inbox, fluxos básicos |
| **Professional** | R$ 297/mês | WhatsApp + Instagram, IA, campanhas, ASAAS |
| **Enterprise** | R$ 797/mês | Ilimitado, white-label, SLA e sucesso dedicado |

## Stack

| Serviço | Tecnologia |
|---------|------------|
| `apps/api` | NestJS + JWT + Socket.io |
| `apps/worker` | BullMQ |
| `apps/web` | React + Vite + Tailwind |
| `packages/database` | Prisma / PostgreSQL |
| WhatsApp | Evolution API |
| Instagram | Meta Graph API (webhook + demo) |
| Cache/filas | Redis |

## Setup local

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm --filter @bot-wpp/api dev
pnpm --filter @bot-wpp/web dev
```

### Acessos seed

- Frontend: http://localhost:5173
- Planos públicos: http://localhost:5173/planos
- API: http://localhost:3000/api
- **Owner GB Systems:** `admin@gbsystems.com.br` / `admin123` (Painel Admin)
- **Tenant demo:** `admin@demo.gbsystems.com.br` / `admin123`

### Instagram (produção)

Defina no `.env`:

```
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=gb-systems-verify
META_PAGE_ACCESS_TOKEN=
```

Webhook: `POST/GET /api/instagram/webhook`
