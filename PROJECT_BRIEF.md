# PROJECT BRIEF — WhatsApp CRM / Atendimento SaaS

Multi-tenant SaaS for WhatsApp customer service, automation, AI agent, Kanban CRM, mass campaigns and payments (ASAAS). Inspired by SoulPlus / Vbot.

## Stack (mandatory)

- Backend: NestJS + TypeScript
- DB: PostgreSQL + Prisma (+ pgvector for RAG later)
- Cache/queues: Redis + BullMQ
- Realtime: Socket.io
- WhatsApp: Evolution API (webhooks + REST)
- AI: OpenAI / Anthropic adapters (per-tenant API keys)
- Frontend: React + Vite + Tailwind + shadcn/ui
- Flow builder: React Flow | Kanban: dnd-kit
- Deploy: Docker / EasyPanel

## Conventions

- Code, commits, comments: English
- UI copy: Portuguese (Brazil)
- TypeScript `strict: true`
- Every table has `tenantId`; all queries filter by tenant
- Domain modules as separate NestJS modules

## Monorepo

```
/apps/api          NestJS API + Socket.io
/apps/worker       BullMQ workers
/apps/web          React frontend
/packages/database Prisma schema + client
/packages/shared-types Shared TS types
/docker            docker-compose
```

Tooling: **pnpm workspaces + Turborepo**

## Phases

| Phase | Scope |
|-------|--------|
| 0 | Foundation: monorepo, JWT auth, Prisma, docker-compose |
| 1 | Evolution API, inbox, Kanban, tags, quick replies |
| 2 | Flow builder, AI/RAG, human handoff |
| 3 | Campaigns, ASAAS, reports |
| 4 | Onboarding, plans, white-label, audit |

Work **phase by phase**. Stop after each phase for confirmation before continuing.
