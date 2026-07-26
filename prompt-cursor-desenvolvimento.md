# PROMPT — Cole isto no Cursor (Agent mode) para iniciar o projeto

Copie tudo a partir da linha abaixo e cole como primeira mensagem para o agente no Cursor. Recomendo colar isso num arquivo `PROJECT_BRIEF.md` na raiz do repositório também, para o agente poder reconsultar depois.

---

Você vai me ajudar a construir, do zero, uma plataforma SaaS de atendimento, automação e CRM para WhatsApp. É um sistema profissional, multi-tenant (várias empresas-cliente usando o mesmo sistema, cada uma com seus dados isolados), inspirado em produtos como Vbot e SoulPlus, mas mais completo.

## Regra mais importante: construa em fases, não tudo de uma vez

Não tente gerar o projeto inteiro numa única resposta. Trabalhe fase por fase (a lista está na seção "Fases de construção" abaixo). Ao final de cada fase, pare, resuma o que foi feito, rode o que for possível localmente e só avance para a próxima fase depois que eu confirmar. Se alguma decisão de arquitetura tiver mais de um caminho razoável, me pergunte antes de escolher.

## Stack técnica (obrigatória, não sugira alternativas sem eu pedir)

- **Backend:** Node.js + TypeScript, framework NestJS
- **Banco de dados:** PostgreSQL, ORM Prisma
- **Busca semântica / RAG (IA):** extensão pgvector no próprio Postgres (não usar banco vetorial separado)
- **Cache e filas:** Redis + BullMQ (para disparos em massa e processamento de webhooks)
- **Tempo real:** Socket.io (WebSockets) para o chat ao vivo
- **Conexão WhatsApp:** Evolution API (self-hosted, já vou rodar num VPS via EasyPanel) — o backend consome a API REST e recebe eventos via webhook dela
- **IA (modelo de linguagem):** integração abstraída por interface própria, com adaptadores para OpenAI e Anthropic (a empresa escolhe o provedor e informa a própria chave de API)
- **Frontend:** React + TypeScript + Vite, Tailwind CSS, componentes shadcn/ui
- **Construtor de fluxo visual (automação):** React Flow (xyflow)
- **Kanban (CRM):** dnd-kit
- **Pagamentos:** API do ASAAS (Pix, boleto, cartão)
- **Deploy:** Docker — cada serviço em container separado (api, worker, frontend, evolution-api, postgres, redis), compatível com EasyPanel

## Convenções de código

- Nomes de variáveis, funções, classes, commits e comentários: **em inglês**, seguindo convenção internacional
- Textos de interface (o que o usuário final vê): **em português do Brasil**
- TypeScript estrito (`strict: true`), sem `any` implícito
- Cada módulo de domínio (auth, contacts, conversations, kanban, flows, campaigns, payments, ai-agent) como um módulo NestJS separado, com seus próprios controllers/services/DTOs
- Toda tabela do banco tem `tenant_id` e as queries sempre filtram por tenant (nunca confiar em filtro só no frontend)
- Escreva testes básicos (unitários) para regras de negócio críticas (ex: distribuição de conversas, cálculo de funil, cobrança)
- Documente variáveis de ambiente num `.env.example` sempre que adicionar uma nova

## Modelo de dados inicial (Prisma) — ponto de partida, ajuste conforme necessário

```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  users     User[]
  contacts  Contact[]
  instances WhatsappInstance[]
}

model User {
  id       String @id @default(cuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  email    String @unique
  name     String
  role     UserRole @default(AGENT)
}

enum UserRole {
  ADMIN
  SUPERVISOR
  AGENT
}

model WhatsappInstance {
  id                 String @id @default(cuid())
  tenantId           String
  tenant             Tenant @relation(fields: [tenantId], references: [id])
  evolutionInstanceId String
  phoneNumber        String
  status             String
}

model Contact {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  name         String?
  phone        String
  customFields Json?
  tags         Tag[]
  conversations Conversation[]
  kanbanCards  KanbanCard[]
}

model Tag {
  id       String    @id @default(cuid())
  tenantId String
  name     String
  color    String
  contacts Contact[]
}

model Conversation {
  id         String   @id @default(cuid())
  tenantId   String
  contactId  String
  contact    Contact  @relation(fields: [contactId], references: [id])
  assignedTo String?
  status     String
  messages   Message[]
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  direction      String   // inbound | outbound
  type           String   // text | image | audio | video | document
  content        String
  createdAt      DateTime @default(now())
}

model KanbanBoard {
  id       String @id @default(cuid())
  tenantId String
  name     String
  stages   KanbanStage[]
}

model KanbanStage {
  id      String @id @default(cuid())
  boardId String
  board   KanbanBoard @relation(fields: [boardId], references: [id])
  name    String
  order   Int
  cards   KanbanCard[]
}

model KanbanCard {
  id        String @id @default(cuid())
  stageId   String
  stage     KanbanStage @relation(fields: [stageId], references: [id])
  contactId String
  contact   Contact @relation(fields: [contactId], references: [id])
  dealValue Decimal?
  order     Int
}

model Flow {
  id       String @id @default(cuid())
  tenantId String
  name     String
  trigger  String
  nodes    Json   // definição visual do fluxo (nós e conexões)
  active   Boolean @default(true)
}

model Campaign {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  message   String
  scheduledAt DateTime?
  status    String
}

model Payment {
  id        String   @id @default(cuid())
  tenantId  String
  contactId String
  amount    Decimal
  status    String
  gateway   String   // asaas
  link      String?
  createdAt DateTime @default(now())
}

model AIAgent {
  id           String @id @default(cuid())
  tenantId     String
  name         String
  persona      String
  modelProvider String // openai | anthropic
  active       Boolean @default(true)
}
```

Ajuste, normalize e adicione índices conforme achar necessário — isso é só o ponto de partida.

## Estrutura de pastas sugerida

```
/apps
  /api          → backend NestJS
  /worker       → processador de filas (BullMQ) — disparos, webhooks
  /web          → frontend React
/packages
  /shared-types → tipos TypeScript compartilhados entre api/web
/docker
  docker-compose.yml
PROJECT_BRIEF.md
```

## Fases de construção

**Fase 0 — Fundação**
Monorepo configurado, autenticação (login + JWT + multi-tenant), schema inicial do Prisma migrado, docker-compose local funcionando (postgres, redis, api, web).

**Fase 1 — MVP de atendimento**
Integração com Evolution API (conectar número via QR Code, receber webhook de mensagem), inbox em tempo real no frontend, envio/recebimento de mensagens de texto e mídia, Kanban básico com drag-and-drop, tags, respostas rápidas.

**Fase 2 — Automação e IA**
Construtor visual de fluxo (React Flow) com nós de gatilho/condição/ação, execução do fluxo no backend, agente de IA com base de conhecimento (upload de documento → embeddings via pgvector → resposta com RAG), fallback para humano.

**Fase 3 — Campanhas e pagamentos**
Disparo em massa segmentado por tag/etapa do Kanban, fila de envio com limitação de taxa, integração com ASAAS (gerar link, receber webhook de confirmação), relatórios básicos (volume, tempo de resposta, funil).

**Fase 4 — Multi-tenant completo**
Onboarding de novo tenant, planos e limites de uso, customização de marca (logo/cor) por tenant, log de auditoria.

## Comece assim

1. Confirme comigo que entendeu o objetivo geral antes de gerar qualquer código.
2. Proponha a estrutura de pastas final e a configuração inicial do monorepo (posso usar Turborepo ou pnpm workspaces — sugira o que fizer mais sentido).
3. Só depois disso, comece a Fase 0.
