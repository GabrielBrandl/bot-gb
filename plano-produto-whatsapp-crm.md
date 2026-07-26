# Plano de Produto — Plataforma de Atendimento, Automação e CRM para WhatsApp

## 1. Visão geral

Uma plataforma SaaS multi-tenant (várias empresas-cliente usando o mesmo sistema, cada uma isolada) que centraliza atendimento via WhatsApp, automação de conversas, agente de IA, CRM em Kanban, campanhas em massa e pagamentos — tudo num único painel. Pensada para nascer atendendo a ABS Resolve, mas já estruturada para ser vendida a outras empresas depois.

## 2. Referências de mercado

Duas plataformas brasileiras desse segmento (atendimento + CRM + automação em WhatsApp):

- **SoulPlus** — se posiciona como plataforma omnichannel (WhatsApp, Instagram, Messenger, Webchat, Telegram), com CRM integrado ao chat, disparo em massa (SMS, WhatsApp oficial e não-oficial, torpedo de voz) e assistentes de IA. Trabalha tanto com API oficial da Meta quanto com WhatsApp Business comum.
- **Vbot** — foco em WhatsApp + Instagram + Facebook, com agente de IA, link de pagamento direto no chat, CRM "baseado em conversas" e disparos agendados. É mantido pela **Vanguarda Martech** — vale notar, já que é onde você faz estágio.

Ambas vendem essencialmente a mesma combinação: **inbox unificado + automação + IA + CRM + disparos + pagamento**. O espaço para diferenciação está em profundidade de cada módulo e em modelo de negócio (branco/revenda), não em inventar uma categoria nova.

## 3. Diferenciais propostos

O que pode deixar sua plataforma genuinamente melhor, não só "parecida":

1. **Conexão híbrida** — Evolution API cobre tanto número comum (QR Code, sem custo por conversa) quanto API oficial da Meta no mesmo backend. Isso permite atender desde o pequeno cliente (custo baixo) até uma conta enterprise que exige selo oficial, sem trocar de arquitetura.
2. **IA com base de conhecimento real (RAG)**, não só respostas prontas — o agente responde com base em documentos/FAQs que a própria empresa sobe, com citação de fonte interna e fallback claro para humano quando não tem certeza.
3. **CRM realmente amarrado à conversa** — cada card do Kanban abre o histórico completo da conversa, não é um CRM "plugado por fora" com sincronização manual.
4. **Pagamento nativo dentro do fluxo de automação** — o link de pagamento (ASAAS) pode ser disparado automaticamente por uma regra do bot, não só manualmente por um atendente.
5. **Multi-tenant e white-label desde o início** — pensado desde a arquitetura para revender a outras empresas com marca própria, o que abre um segundo modelo de receita (não só ABS Resolve como cliente único).
6. **Dados na sua própria infraestrutura** (self-hosted via EasyPanel) — argumento forte de privacidade/LGPD para vender a empresas que se preocupam com isso.

## 4. Módulos e funcionalidades completas

### 4.1 Conexão e canais
- Conectar múltiplos números de WhatsApp via QR Code (Evolution API)
- Suporte futuro a WhatsApp Cloud API oficial no mesmo painel
- Reconexão automática, monitoramento de saúde da sessão, alerta se cair
- Status visual de cada número (conectado / desconectado / erro)

### 4.2 Atendimento (Inbox)
- Inbox unificado — todas as conversas de todos os números num só painel
- Chat em tempo real (texto, imagem, áudio, vídeo, documento, localização)
- Fila de atendimento com distribuição automática entre agentes (round-robin ou manual)
- Transferência de conversa entre agentes/setores
- Notas internas (visíveis só pra equipe, não pro cliente)
- Respostas rápidas / mensagens salvas (atalhos)
- Tags/etiquetas por conversa e por contato
- Busca em todo o histórico de conversas
- Horário de atendimento configurável + mensagem de ausência automática
- Indicador de "digitando..." e confirmação de leitura

### 4.3 Automação (Flow Builder)
- Construtor visual de fluxos (arrastar e soltar, tipo nós conectados)
- Gatilhos por palavra-chave, menu numerado ou botão
- Lógica condicional (se resposta = X, vai para Y)
- Coleta de variáveis dentro da conversa (nome, endereço, tipo de serviço etc.) e armazenamento no cadastro do contato
- Chamada de API externa dentro do fluxo (webhook) — ex: consultar CEP, gerar cobrança
- Transferência automática para humano quando o fluxo não resolve
- Agendamento de horários dentro do próprio fluxo

### 4.4 IA / Agente inteligente
- Agente de IA configurável por empresa (tom de voz, persona, regras do que pode/não pode responder)
- Base de conhecimento própria por upload de documentos/FAQ (RAG)
- Múltiplos provedores de modelo (OpenAI, Anthropic, outros) configuráveis por chave de API
- Fallback automático para atendente humano quando a IA não tem confiança na resposta
- Sugestão de resposta pro atendente humano (IA assistiva, não só autônoma)
- Qualificação de lead automática (pontuação de interesse baseada na conversa)

### 4.5 CRM em Kanban
- Quadro Kanban com colunas/etapas customizáveis (ex: Novo lead → Orçamento → Agendado → Concluído → Pago)
- Card do lead com histórico completo da conversa vinculado
- Campos customizados por contato (endereço, tipo de serviço, valor do orçamento etc.)
- Valor do negócio por card, taxa de conversão por etapa
- Tarefas e lembretes vinculados a um lead
- Arrastar card entre colunas atualiza automaticamente o status do atendimento

### 4.6 Campanhas / Disparos em massa
- Envio segmentado por tag, etapa do Kanban ou campo customizado
- Modelos de mensagem com variáveis (nome, serviço etc.)
- Agendamento (enviar agora, depois, ou recorrente — ex: lembrete mensal de manutenção)
- Limitação de velocidade de disparo (para reduzir risco de bloqueio no número não-oficial)
- Métricas por campanha: enviados, entregues, lidos, respondidos, opt-out

### 4.7 Pagamentos
- Geração de link de pagamento via ASAAS (Pix, boleto, cartão)
- Envio automático do link dentro de um fluxo ou campanha
- Confirmação automática de pagamento via webhook do ASAAS
- Emissão de recibo automático após confirmação
- Histórico financeiro por contato/empresa

### 4.8 Relatórios e dashboards
- Volume de mensagens, tempo médio de resposta, tempo médio de resolução
- Desempenho por agente
- Proporção de atendimento resolvido por bot x humano
- Funil de conversão do CRM (quantos leads viram venda, por etapa)
- ROI de campanhas

### 4.9 Administração e multi-tenant
- Cada empresa-cliente como um "tenant" isolado (dados separados)
- Papéis de usuário: administrador, supervisor, agente
- Gestão de equipe e setores/departamentos
- Configuração de webhooks e integrações externas
- Painel de billing/assinatura por tenant (planos, limites de uso)
- Customização de marca por tenant (logo, cor) — para revenda white-label

### 4.10 Segurança e LGPD
- Dados hospedados em infraestrutura própria (self-hosted)
- Controle de acesso por papel, autenticação em duas etapas
- Log de auditoria (quem viu/alterou o quê)
- Política de retenção e exclusão de dados do titular

## 5. Arquitetura técnica recomendada

| Camada | Tecnologia | Por quê |
|---|---|---|
| Backend | Node.js + TypeScript + NestJS | Estrutura modular madura, ótima para multi-tenant e times crescendo |
| Banco de dados | PostgreSQL + Prisma ORM | Relacional, robusto, type-safe, fácil de versionar schema |
| IA / busca semântica | pgvector (extensão do Postgres) | Evita banco vetorial separado — RAG direto no Postgres |
| Cache e filas | Redis + BullMQ | Necessário para processar disparos em massa e webhooks sem travar o app |
| Tempo real | Socket.io (WebSockets) | Chat ao vivo no inbox |
| Conexão WhatsApp | Evolution API (self-hosted) | Você já decidiu esse caminho — roda no seu EasyPanel, multi-instância nativa |
| IA (modelo) | API da OpenAI e/ou Anthropic | Abstrair por interface própria para trocar de provedor sem reescrever tudo |
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui | Produtivo, ótimo suporte no Cursor, visual profissional pronto |
| Construtor de fluxo visual | React Flow (xyflow) | Biblioteca padrão de mercado pra esse tipo de editor de nós |
| Kanban | dnd-kit | Drag-and-drop leve e acessível |
| Pagamentos | API do ASAAS | Já decidido |
| Deploy | Docker + EasyPanel | Você já tem — cada serviço (API, worker, frontend, Evolution API, Postgres, Redis) roda em container separado |

## 6. Roadmap por fases

| Fase | Conteúdo | Estimativa* |
|---|---|---|
| 0 — Fundação | Monorepo, autenticação multi-tenant, banco de dados, deploy inicial no EasyPanel | 1–2 semanas |
| 1 — MVP de atendimento | Conectar número via Evolution API, inbox unificado, Kanban básico, tags, respostas rápidas | 3–4 semanas |
| 2 — Automação + IA | Flow builder visual, agente de IA com base de conhecimento, handoff pra humano | 3–4 semanas |
| 3 — Campanhas + pagamentos | Disparo em massa, integração ASAAS, relatórios básicos | 2–3 semanas |
| 4 — Multi-tenant completo | Onboarding self-service, planos/billing, white-label | 3–4 semanas |

*Estimativa para um desenvolvedor(a) trabalhando com apoio de IA (Cursor); varia conforme tempo dedicado.

## 7. Sugestão de modelo de planos (opcional, para quando for revender)

| Plano | Público | Inclui |
|---|---|---|
| Starter | Pequena empresa, 1 número | Inbox + Kanban + respostas rápidas |
| Pro | Empresa em crescimento | + Automação + IA + campanhas |
| Enterprise / White-label | Agências revendendo pra clientes próprios | + multi-número + marca própria + relatórios avançados |
