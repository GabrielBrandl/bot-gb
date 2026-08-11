import { PrismaClient, UserRole, Channel } from "@prisma/client";

type FlowGraph = {
  nodes: Array<{
    id: string;
    type: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string }>;
};

function linearFlow(
  messages: Array<{ id: string; label: string; text: string }>,
  opts?: { transferHuman?: boolean; transferId?: string; aiReply?: { id: string; agentId: string } },
): FlowGraph {
  const nodes: FlowGraph["nodes"] = [
    {
      id: "t1",
      type: "trigger",
      data: { label: "Gatilho" },
      position: { x: 40, y: 120 },
    },
  ];
  const edges: FlowGraph["edges"] = [];
  let prev = "t1";
  let x = 280;

  for (const msg of messages) {
    nodes.push({
      id: msg.id,
      type: "send_text",
      data: { label: msg.label, text: msg.text },
      position: { x, y: 120 },
    });
    edges.push({ id: `e-${prev}-${msg.id}`, source: prev, target: msg.id });
    prev = msg.id;
    x += 240;
  }

  if (opts?.aiReply) {
    nodes.push({
      id: opts.aiReply.id,
      type: "ai_reply",
      data: { label: "Claude — análise complexa", agentId: opts.aiReply.agentId },
      position: { x, y: 120 },
    });
    edges.push({ id: `e-${prev}-${opts.aiReply.id}`, source: prev, target: opts.aiReply.id });
    prev = opts.aiReply.id;
    x += 240;
  }

  if (opts?.transferHuman) {
    const tid = opts.transferId ?? "human";
    nodes.push({
      id: tid,
      type: "transfer_human",
      data: { label: "Fila humana" },
      position: { x, y: 120 },
    });
    edges.push({ id: `e-${prev}-${tid}`, source: prev, target: tid });
  }

  return { nodes, edges };
}

const FIRM = "Mendes & Associados Advocacia";
const OAB = "OAB/AM 00.000";
const PHONE = "(92) =======-0000";
const EMAIL = "contato@mendesadvocacia.demo";
const ADDRESS = "Av. Eduardo Ribeiro, 1000 — Centro, Manaus/AM";

const CLAUDE_SYSTEM_PROMPT = `Você é o *Assistente Jurídico* do escritório *${FIRM}* (${OAB}).
Canal: WhatsApp. Você é um *sistema automatizado* (IA Claude), nunca finja ser advogado humano.

Conformidade (OAB Provimento 205/2021 e ética profissional):
- Identifique-se como assistente virtual quando fizer sentido.
- NÃO dê parecer jurídico vinculante, NÃO analise o mérito do caso concreto como se fosse consulta formal.
- NÃO prometa resultado processual, êxito ou “ganhar a causa”.
- NÃO incentive litigância temerária nem oriente a ocultar provas/fatos.
- Em dúvidas sobre o caso concreto: faça triagem, oriente a agendar consulta e ofereça transferir a um advogado.
- Trate dados com sigilo (LGPD). Não peça senhas de gov.br, tokens bancários ou documentos sensíveis por WhatsApp além do necessário para triagem (nome, cidade, área do direito, urgência).

Estilo:
- Português do Brasil, cordial, sóbrio e profissional (sem emojis excessivos).
- Respostas curtas para WhatsApp (2–4 parágrafos curtos ou lista).
- Se o tema for complexo (prescrição, estratégia, cálculo trabalhista detalhado, interpretação de decisão): explique limites, faça perguntas de triagem e sugira consulta.

Áreas do escritório (fictício): Direito Trabalhista, Família e Sucessões, Consumidor, Previdenciário e Cível/Contratos.
Horário humano: seg–sex 08:00–18:00 (America/Manaus). Contato: ${EMAIL} | ${PHONE}.
Quando não souber ou precisar de humano: diga que um advogado dará continuidade e peça nome completo + melhor horário.`;

const MENU_TEXT = `Olá! Bem-vindo(a) ao WhatsApp da *${FIRM}*.

Sou o *assistente virtual* do escritório (atendimento automatizado). Quando necessário, um *advogado humano* assume a conversa.

Este canal é *receptivo*: você iniciou o contato. Seus dados serão usados apenas para triagem e retorno, em conformidade com a *LGPD*.

Como posso ajudar hoje?

*1.* Quero orientação / novo atendimento
*2.* Já sou cliente — acompanhar processo
*3.* Áreas de atuação
*4.* Consulta e honorários
*5.* Urgente / prazo legal
*6.* Privacidade (LGPD)
*7.* Falar com a IA (dúvida mais complexa)
*8.* Falar com um advogado agora

Digite o *número* da opção ou *menu* a qualquer momento.`;

const HOURS_TEXT = `*Horário de atendimento humano*

Segunda a sexta: *08:00 – 18:00*
Sábado e domingo: *fechado*
Fuso: Manaus (America/Manaus)

Fora desse horário, o assistente virtual continua disponível para triagem. Um advogado retorna no próximo horário útil.

📍 ${ADDRESS}
📞 ${PHONE}
✉️ ${EMAIL}`;

const NEW_CLIENT_TEXT = `Perfeito. Vamos fazer uma *triagem inicial* (sem substituir consulta jurídica).

Por favor, responda em uma mensagem:

1️⃣ *Nome completo*
2️⃣ *Cidade/UF*
3️⃣ *Área* (trabalhista / família / consumidor / previdenciário / cível)
4️⃣ *Resumo objetivo* do que aconteceu (sem dados bancários ou senhas)
5️⃣ Há *prazo* ou audiência próxima? (sim/não — qual?)

Com isso, encaminhamos ao advogado da área. Se preferir, digite *8* para falar com a equipe agora.`;

const CLIENT_PROCESS_TEXT = `Certo. Para localizar seu atendimento, envie:

• *Nome completo* (como no contrato/procuração)
• *Número do processo* (se tiver) *ou* CPF do titular
• O que deseja saber (andamento, documentos, audiência, honorários)

⚠️ Informações processuais oficiais estão no *Tribunal* / *Projudi*. Aqui confirmamos o que estiver sob nossos cuidados e um advogado valida quando necessário.

Digite *8* para atendimento humano imediato.`;

const AREAS_TEXT = `*Áreas de atuação — ${FIRM}*

• *Trabalhista* — vínculos, verbas, assédio, rescisões
• *Família e Sucessões* — divórcio, guarda, pensão, inventário
• *Consumidor* — cobranças indevidas, vícios, planos e contratos
• *Previdenciário* — aposentadorias, benefícios, revisões (triagem)
• *Cível / Contratos* — cobranças, indenizações, revisão contratual

Não atuamos com captação ativa por disparo em massa. Este WhatsApp responde a quem nos procura.

Digite *1* para iniciar triagem ou *7* para uma dúvida mais elaborada com a IA.`;

const FEES_TEXT = `*Consulta e honorários*

A primeira conversa aqui é de *triagem*. Valores de honorários dependem da complexidade, urgência e área — definidos em *proposta formal* após análise pelo advogado, com transparência contractual.

Em regra:
• Consulta inicial (agendada): valores informados na confirmação
• Ações e contratos: honorários por etapa / êxito *somente quando legalmente cabível e contratado* — sem promessa de resultado

Para agendar, digite *1* (triagem) ou *8* (humano).`;

const URGENT_TEXT = `Entendi que pode haver *urgência ou prazo*.

⚠️ Prazos processuais são críticos. Não deixe para o último momento.

Encaminhando você à *fila de atendimento humano*. Enquanto isso, envie:

• Nome completo
• Cidade/UF
• Qual o prazo / data (se souber)
• Resumo em 3–5 linhas

Um advogado retornará com prioridade no horário de expediente (ou conforme plantão interno).`;

const LGPD_TEXT = `*Privacidade e LGPD*

Tratamos seus dados para *atendimento, triagem e retorno do escritório*, com base no legítimo interesse e/ou execução de medidas pré-contratuais, conforme a Lei 13.709/2018.

Você pode solicitar acesso, correção ou exclusão dos dados de contato pelo e-mail *${EMAIL}*.

Não compartilhe senhas, códigos de autenticação ou dados bancários completos neste chat.`;

const AI_INTRO_TEXT = `Você será atendido(a) pela *IA do escritório* (Claude), para dúvidas *mais complexas* ou aprofundamento.

Lembrete importante: a IA *não substitui* advogado, *não emite parecer* vinculante e *não promete resultado*. Para estratégia do seu caso, agende consulta.

Pode enviar sua pergunta agora.`;

const HUMAN_TEXT = `Certo. Vou transferir você para a *equipe jurídica humana*.

Enquanto aguarda, informe *nome completo* e o *assunto*. No horário de expediente, um advogado ou atendente assume esta conversa.

${HOURS_TEXT}`;

const CLOSE_TEXT = `Agradecemos o contato com a *${FIRM}*.

Se precisar novamente, digite *menu*. Desejamos um ótimo dia.`;

const AWAY_TEXT = `Recebemos sua mensagem fora do *horário de atendimento humano*.

${HOURS_TEXT}

O assistente virtual pode seguir com triagem. Digite *menu* para ver as opções. Um advogado retornará no próximo horário útil.`;

export async function seedAdvocacia(prisma: PrismaClient, passwordHash: string) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "mendes-advocacia" },
    update: {
      name: FIRM,
      planId: "PRO",
      plan: "PRO",
      primaryColor: "#1B3A4B",
      logoUrl: "/brand/gb-systems-logo.png",
      maxAgents: 12,
      maxInstances: 2,
      maxInstagram: 0,
      maxContacts: 8000,
      billingStatus: "active",
    },
    create: {
      name: FIRM,
      slug: "mendes-advocacia",
      planId: "PRO",
      plan: "PRO",
      primaryColor: "#1B3A4B",
      logoUrl: "/brand/gb-systems-logo.png",
      maxAgents: 12,
      maxInstances: 2,
      maxInstagram: 0,
      maxContacts: 8000,
      billingStatus: "active",
    },
  });

  const team: Array<{ email: string; name: string; role: UserRole }> = [
    { email: "admin@mendesadvocacia.demo", name: "Dra. Ana Mendes", role: UserRole.ADMIN },
    { email: "socio@mendesadvocacia.demo", name: "Dr. Ricardo Mendes", role: UserRole.SUPERVISOR },
    { email: "atendimento@mendesadvocacia.demo", name: "Atendimento Mendes", role: UserRole.AGENT },
    { email: "trabalhista@mendesadvocacia.demo", name: "Adv. Trabalhista", role: UserRole.AGENT },
  ];

  for (const member of team) {
    await prisma.user.upsert({
      where: { email: member.email },
      update: {
        passwordHash,
        name: member.name,
        role: member.role,
        tenantId: tenant.id,
        active: true,
      },
      create: {
        tenantId: tenant.id,
        email: member.email,
        name: member.name,
        passwordHash,
        role: member.role,
        active: true,
      },
    });
  }

  await prisma.businessHours.upsert({
    where: { tenantId: tenant.id },
    update: {
      timezone: "America/Manaus",
      awayMessage: AWAY_TEXT,
      schedule: {
        mon: { open: "08:00", close: "18:00" },
        tue: { open: "08:00", close: "18:00" },
        wed: { open: "08:00", close: "18:00" },
        thu: { open: "08:00", close: "18:00" },
        fri: { open: "08:00", close: "18:00" },
        sat: null,
        sun: null,
      },
    },
    create: {
      tenantId: tenant.id,
      timezone: "America/Manaus",
      awayMessage: AWAY_TEXT,
      schedule: {
        mon: { open: "08:00", close: "18:00" },
        tue: { open: "08:00", close: "18:00" },
        wed: { open: "08:00", close: "18:00" },
        thu: { open: "08:00", close: "18:00" },
        fri: { open: "08:00", close: "18:00" },
        sat: null,
        sun: null,
      },
    },
  });

  let board = await prisma.kanbanBoard.findFirst({ where: { tenantId: tenant.id } });
  if (!board) {
    board = await prisma.kanbanBoard.create({
      data: { tenantId: tenant.id, name: "Funil — Leads Jurídicos" },
    });
    await prisma.kanbanStage.createMany({
      data: [
        { tenantId: tenant.id, boardId: board.id, name: "Novo contato", order: 0 },
        { tenantId: tenant.id, boardId: board.id, name: "Triagem", order: 1 },
        { tenantId: tenant.id, boardId: board.id, name: "Consulta agendada", order: 2 },
        { tenantId: tenant.id, boardId: board.id, name: "Proposta / contrato", order: 3 },
        { tenantId: tenant.id, boardId: board.id, name: "Cliente ativo", order: 4 },
      ],
    });
  }

  await prisma.whatsappInstance.upsert({
    where: {
      tenantId_evolutionInstanceId: {
        tenantId: tenant.id,
        evolutionInstanceId: "demo-mendes-advocacia",
      },
    },
    update: {
      status: "connected",
      name: "WhatsApp Mendes Advocacia",
      phoneNumber: "5592999900100",
    },
    create: {
      tenantId: tenant.id,
      name: "WhatsApp Mendes Advocacia",
      evolutionInstanceId: "demo-mendes-advocacia",
      phoneNumber: "5592999900100",
      status: "connected",
    },
  });

  const agent = await prisma.aIAgent.upsert({
    where: { id: "seed-ai-agent-mendes-claude" },
    update: {
      tenantId: tenant.id,
      name: "Assistente Jurídico",
      persona: "Assistente virtual jurídico com Claude — Mendes & Associados",
      modelProvider: "anthropic",
      active: true,
      systemPrompt: CLAUDE_SYSTEM_PROMPT,
    },
    create: {
      id: "seed-ai-agent-mendes-claude",
      tenantId: tenant.id,
      name: "Assistente Jurídico",
      persona: "Assistente virtual jurídico com Claude — Mendes & Associados",
      modelProvider: "anthropic",
      active: true,
      systemPrompt: CLAUDE_SYSTEM_PROMPT,
    },
  });

  await prisma.knowledgeDocument.deleteMany({ where: { tenantId: tenant.id, agentId: agent.id } });
  await prisma.knowledgeDocument.createMany({
    data: [
      {
        tenantId: tenant.id,
        agentId: agent.id,
        title: "Institucional Mendes & Associados",
        content: `${FIRM} (${OAB}). Endereço: ${ADDRESS}. Contato: ${PHONE} / ${EMAIL}. Atendimento humano seg–sex 08:00–18:00 (Manaus). WhatsApp receptivo; sem captação ativa.`,
      },
      {
        tenantId: tenant.id,
        agentId: agent.id,
        title: "Áreas de atuação",
        content:
          "Trabalhista; Família e Sucessões; Direito do Consumidor; Previdenciário (triagem); Cível e Contratos. Triagem inicial via WhatsApp; parecer e estratégia somente em consulta com advogado.",
      },
      {
        tenantId: tenant.id,
        agentId: agent.id,
        title: "Regras OAB e LGPD no canal",
        content:
          "Provimento 205/2021: chatbot permitido para dúvidas iniciais e informações do escritório. Vedado prometer resultado. Identificar-se como sistema automatizado. LGPD: dados só para triagem e retorno; não pedir senhas ou dados bancários sensíveis.",
      },
      {
        tenantId: tenant.id,
        agentId: agent.id,
        title: "Quando escalar para humano",
        content:
          "Escalar se: prazo/audiência iminente; pedido explícito de advogado; caso emocionalmente sensível (violência, guarda urgente); necessidade de análise de documentos ou estratégia processual.",
      },
    ],
  });

  await prisma.flow.deleteMany({ where: { tenantId: tenant.id } });

  const flows: Array<{ name: string; trigger: string; graph: FlowGraph }> = [
    {
      name: "01 — Boas-vindas e menu",
      trigger: "oi|olá|ola|bom dia|boa tarde|boa noite|menu|inicio|início|começar|comecar|ajuda|hello|hi",
      // Horário humano só fora do expediente (BusinessHours.awayMessage).
      graph: linearFlow([{ id: "m1", label: "Menu", text: MENU_TEXT }]),
    },
    {
      name: "02 — Novo atendimento / triagem",
      trigger: "1|novo|contratar|orientação|orientacao|preciso de advogado|quero advogado",
      graph: linearFlow([{ id: "m1", label: "Triagem", text: NEW_CLIENT_TEXT }], {
        transferHuman: true,
      }),
    },
    {
      name: "03 — Cliente — processo",
      trigger: "2|processo|andamento|já sou cliente|ja sou cliente|meu processo",
      graph: linearFlow([{ id: "m1", label: "Processo", text: CLIENT_PROCESS_TEXT }], {
        transferHuman: true,
      }),
    },
    {
      name: "04 — Áreas de atuação",
      trigger: "3|áreas|areas|atuação|atuacao|trabalhista|família|familia|consumidor|previdenciário|previdenciario|cível|civel",
      graph: linearFlow([{ id: "m1", label: "Áreas", text: AREAS_TEXT }]),
    },
    {
      name: "05 — Consulta e honorários",
      trigger: "4|honorário|honorario|honorários|honorarios|consulta|preço|preco|valor|valores",
      graph: linearFlow([{ id: "m1", label: "Honorários", text: FEES_TEXT }]),
    },
    {
      name: "06 — Urgente / prazo",
      trigger: "5|urgente|urgência|urgencia|prazo|audiência|audiencia|liminar|plantão|plantao",
      graph: linearFlow([{ id: "m1", label: "Urgente", text: URGENT_TEXT }], {
        transferHuman: true,
      }),
    },
    {
      name: "07 — LGPD / privacidade",
      trigger: "6|lgpd|privacidade|dados|meus dados",
      graph: linearFlow([{ id: "m1", label: "LGPD", text: LGPD_TEXT }]),
    },
    {
      name: "08 — IA Claude (dúvidas complexas)",
      trigger: "7|ia|claude|dúvida complexa|duvida complexa|inteligência|inteligencia|assistente",
      graph: linearFlow([{ id: "m1", label: "Intro IA", text: AI_INTRO_TEXT }], {
        aiReply: { id: "ai1", agentId: agent.id },
      }),
    },
    {
      name: "09 — Falar com advogado",
      trigger: "8|humano|advogado|atendente|pessoa|falar com alguém|falar com alguem",
      graph: linearFlow([{ id: "m1", label: "Humano", text: HUMAN_TEXT }], {
        transferHuman: true,
      }),
    },
    {
      name: "10 — Encerramento",
      trigger: "obrigado|obrigada|valeu|tchau|encerrar|flw|até logo|ate logo",
      graph: linearFlow([{ id: "m1", label: "Encerrar", text: CLOSE_TEXT }]),
    },
  ];

  for (const flow of flows) {
    await prisma.flow.create({
      data: {
        tenantId: tenant.id,
        name: flow.name,
        trigger: flow.trigger,
        channel: Channel.WHATSAPP,
        active: true,
        nodes: flow.graph,
      },
    });
  }

  const quickReplies: Array<{ shortcut: string; title: string; content: string }> = [
    { shortcut: "/menu", title: "Reenviar menu", content: MENU_TEXT },
    { shortcut: "/horario", title: "Horário", content: HOURS_TEXT },
    { shortcut: "/areas", title: "Áreas de atuação", content: AREAS_TEXT },
    { shortcut: "/honorarios", title: "Honorários", content: FEES_TEXT },
    { shortcut: "/lgpd", title: "LGPD", content: LGPD_TEXT },
    {
      shortcut: "/aguardar",
      title: "Aguarde um momento",
      content:
        "Recebemos sua mensagem. Um membro da equipe jurídica dará continuidade em breve. Obrigado pela paciência.",
    },
    { shortcut: "/encerrar", title: "Encerrar", content: CLOSE_TEXT },
  ];

  for (const qr of quickReplies) {
    await prisma.quickReply.upsert({
      where: { tenantId_shortcut: { tenantId: tenant.id, shortcut: qr.shortcut } },
      update: { title: qr.title, content: qr.content },
      create: {
        tenantId: tenant.id,
        shortcut: qr.shortcut,
        title: qr.title,
        content: qr.content,
      },
    });
  }

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    portal: `/t/${tenant.slug}`,
    firm: FIRM,
    agentId: agent.id,
    agentName: agent.name,
    users: team.map((u) => u.email),
  };
}
