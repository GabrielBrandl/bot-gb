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
  opts?: { transferHuman?: boolean; transferId?: string },
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

const MENU_TEXT = `*SUPORTE-TI — UNIESBAM* agradece seu contato.

Para prosseguirmos com seu atendimento, por favor, nos informe o *assunto desejado*:

*1.* Portal do Aluno
*2.* Email Institucional
*3.* Biblioteca Virtual
*4.* Atividades EAD/AVA
*5.* Outros

Caso o tempo de espera seja prolongado, entre em contato pelo e-mail *ti@esbam.edu.br*, informando:
• *NOME COMPLETO*
• *CPF*
• No campo *ASSUNTO*, o tema desejado

Atenciosamente,
*Setor de TI — UNIESBAM*`;

const BOT_TI_SYSTEM_PROMPT = `Você é o *BoTI*, assistente virtual do Setor de TI da UNIESBAM (Faculdade Esbam).

Objetivo: orientar alunos e colaboradores em Portal do Aluno, e-mail institucional, Biblioteca Virtual, AVA/EAD e dúvidas gerais de TI.

Regras:
- Responda em português do Brasil, de forma clara, objetiva e cordial.
- Assine-se mentalmente como BoTI; não invente que é um atendente humano.
- Se o assunto exigir ação técnica (reset de senha, desbloqueio, erro com print), peça NOME COMPLETO + CPF e oriente a aguardar um atendente humano.
- Fora do escopo de TI, diga educadamente e sugira o canal correto quando souber.
- Horário: seg–sex 07:30–21:50, sáb 08:00–11:50 (Manaus). Domingos fechado.
- E-mail de suporte: ti@esbam.edu.br
- Mensagens curtas (WhatsApp): no máximo 2–3 parágrafos curtos.`;

const HOURS_TEXT = `Nosso horário de atendimento é:

*Segunda-feira:* 07:30 – 21:50
*Terça-feira:* 07:30 – 21:50
*Quarta-feira:* 07:30 – 21:50
*Quinta-feira:* 07:30 – 21:50
*Sexta-feira:* 07:30 – 21:50
*Sábado:* 08:00 – 11:50
*Domingo:* Fechado

Fuso: Manaus (America/Manaus)`;

const PORTAL_TEXT = `Qual o problema com seu *PORTAL DO ALUNO*?

Para facilitar o atendimento, se possível nos envie um *print da tela* com a mensagem de erro. 👍

Em seguida, informe também seu *NOME COMPLETO* e *CPF*.
Um atendente do Setor de TI assumirá seu chamado em breve.`;

const EMAIL_TEXT = `Qual o problema com seu *EMAIL INSTITUCIONAL*?

Para facilitar o atendimento, se possível nos envie um *print da tela* com a mensagem de erro. 👍

Informe também seu *NOME COMPLETO* e *CPF*.
Um atendente do Setor de TI assumirá seu chamado em breve.`;

const BIBLIOTECA_TEXT = `Qual o problema com a *BIBLIOTECA VIRTUAL*?

Para facilitar o atendimento, se possível nos envie um *print da tela* com a mensagem de erro. 👍

Informe também seu *NOME COMPLETO* e *CPF*.
Um atendente do Setor de TI assumirá seu chamado em breve.`;

const EAD_TEXT = `Para assuntos de *Atividades EAD/AVA*, procure a Coordenação de EAD:

📧 *coord.ead@esbam.edu.br*
📞 *(92) 3305-1800* — ramal *1838*

Se preferir, digite *menu* para voltar ao início.`;

const OUTROS_TEXT = `Para *outros assuntos*, entre em contato com a equipe de Atendentes Virtuais:

📞 *92 99267-3858*

Ou digite *menu* para voltar ao atendimento do Setor de TI.
Também pode digitar *ramais* para consultar ramais da instituição.`;

const RAMAIS_TEXT = `*Ramais úteis — UNIESBAM*

📍 *Unidade Adrianópolis* — prefixo *(92) 3305-*

*Administração / suporte*
• Tecnologia da Informação (TI): *1829*
• EAD — Ensino a Distância: *1838*
• Biblioteca: *1804*
• Secretaria: *1800 / 1802 / 1801*
• Coordenação Acadêmica: *1811*
• Financeiro (Contas a Receber): *1810*
• Ouvidoria: *1816*
• FIES: *1803*
• Comunicação e Marketing: *1808*
• DP / RH: *1824*
• Portaria: *1858*

*Coordenações de curso (Adrianópolis)*
• Administração / Gestão de RH: *1835*
• Direito: *1828*
• Psicologia: *1836*
• Medicina Veterinária: *1857*
• Análise e Desenvolvimento de Sistemas: *1839*
• Ciências Contábeis / Gestão Financeira: *1834*
• Serviço Social: *1849*
• Ciências Biológicas / Matemática / Pedagogia: *1830*

📍 *Unidade Centro*
• Secretaria Acadêmica: *(92) 3023-9071 / 3023-0851*
• Financeiro: *(92) 3023-0498*
• Coordenação dos Cursos: *(92) 3023-1145*
• TI (ramal interno): *29*

Digite *menu* para voltar ao atendimento do Setor de TI.`;

const CLOSE_TEXT = `Agradecemos o seu contato. Tenha um ótimo dia! 👍

*— Setor de TI | UNIESBAM*`;

/** Enviada automaticamente quando alguém escreve fora do horário comercial. */
const AWAY_TEXT = `No momento estamos *fora do horário de atendimento*.

Nosso horário de atendimento é:

*Segunda-feira:* 07:30 – 21:50
*Terça-feira:* 07:30 – 21:50
*Quarta-feira:* 07:30 – 21:50
*Quinta-feira:* 07:30 – 21:50
*Sexta-feira:* 07:30 – 21:50
*Sábado:* 08:00 – 11:50
*Domingo:* Fechado

Fuso: Manaus (America/Manaus)

Retornaremos assim que possível.
Atenciosamente,
*Setor de TI — UNIESBAM*`;

export async function seedTiEsbam(prisma: PrismaClient, passwordHash: string) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "ti-esbam" },
    update: {
      name: "TI Esbam — UNIESBAM",
      planId: "PRO",
      plan: "PRO",
      primaryColor: "#0B6E4F",
      logoUrl: "/brand/gb-systems-logo.png",
      maxAgents: 15,
      maxInstances: 1,
      maxInstagram: 0,
      maxContacts: 10000,
      billingStatus: "active",
    },
    create: {
      name: "TI Esbam — UNIESBAM",
      slug: "ti-esbam",
      planId: "PRO",
      plan: "PRO",
      primaryColor: "#0B6E4F",
      logoUrl: "/brand/gb-systems-logo.png",
      maxAgents: 15,
      maxInstances: 1,
      maxInstagram: 0,
      maxContacts: 10000,
      billingStatus: "active",
    },
  });

  const team: Array<{ email: string; name: string; role: UserRole }> = [
    { email: "ti.esbam@gmail.com", name: "Admin TI Esbam", role: UserRole.ADMIN },
    { email: "maura.ti.esbam@gmail.com", name: "Maura", role: UserRole.SUPERVISOR },
    { email: "atendente1.ti.esbam@gmail.com", name: "Atendente TI 1", role: UserRole.AGENT },
    { email: "atendente2.ti.esbam@gmail.com", name: "Atendente TI 2", role: UserRole.AGENT },
    { email: "suporte.ti.esbam@gmail.com", name: "Suporte TI", role: UserRole.AGENT },
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
        mon: { open: "07:30", close: "21:50" },
        tue: { open: "07:30", close: "21:50" },
        wed: { open: "07:30", close: "21:50" },
        thu: { open: "07:30", close: "21:50" },
        fri: { open: "07:30", close: "21:50" },
        sat: { open: "08:00", close: "11:50" },
        sun: null,
      },
    },
    create: {
      tenantId: tenant.id,
      timezone: "America/Manaus",
      awayMessage: AWAY_TEXT,
      schedule: {
        mon: { open: "07:30", close: "21:50" },
        tue: { open: "07:30", close: "21:50" },
        wed: { open: "07:30", close: "21:50" },
        thu: { open: "07:30", close: "21:50" },
        fri: { open: "07:30", close: "21:50" },
        sat: { open: "08:00", close: "11:50" },
        sun: null,
      },
    },
  });

  let board = await prisma.kanbanBoard.findFirst({ where: { tenantId: tenant.id } });
  if (!board) {
    board = await prisma.kanbanBoard.create({
      data: { tenantId: tenant.id, name: "Chamados TI — UNIESBAM" },
    });
    await prisma.kanbanStage.createMany({
      data: [
        { tenantId: tenant.id, boardId: board.id, name: "Novo", order: 0 },
        { tenantId: tenant.id, boardId: board.id, name: "Em atendimento", order: 1 },
        { tenantId: tenant.id, boardId: board.id, name: "Aguardando aluno", order: 2 },
        { tenantId: tenant.id, boardId: board.id, name: "Resolvido", order: 3 },
      ],
    });
  }

  await prisma.whatsappInstance.upsert({
    where: {
      tenantId_evolutionInstanceId: {
        tenantId: tenant.id,
        evolutionInstanceId: "demo-ti-esbam",
      },
    },
    update: {
      status: "connected",
      name: "WhatsApp TI UNIESBAM",
      phoneNumber: "5592999990000",
    },
    create: {
      tenantId: tenant.id,
      name: "WhatsApp TI UNIESBAM",
      evolutionInstanceId: "demo-ti-esbam",
      phoneNumber: "5592999990000",
      status: "connected",
    },
  });

  const botTi = await prisma.aIAgent.upsert({
    where: { id: "seed-ai-agent-bot-ti" },
    update: {
      name: "BoTI",
      persona: "Assistente virtual do Setor de TI — UNIESBAM (Claude)",
      modelProvider: "anthropic",
      active: true,
      systemPrompt: BOT_TI_SYSTEM_PROMPT,
      tenantId: tenant.id,
    },
    create: {
      id: "seed-ai-agent-bot-ti",
      tenantId: tenant.id,
      name: "BoTI",
      persona: "Assistente virtual do Setor de TI — UNIESBAM (Claude)",
      modelProvider: "anthropic",
      active: true,
      systemPrompt: BOT_TI_SYSTEM_PROMPT,
    },
  });

  await prisma.knowledgeDocument.deleteMany({ where: { tenantId: tenant.id, agentId: botTi.id } });
  await prisma.knowledgeDocument.createMany({
    data: [
      {
        tenantId: tenant.id,
        agentId: botTi.id,
        title: "Menu e canais de suporte TI",
        content: `${MENU_TEXT}\n\nE-mail: ti@esbam.edu.br`,
      },
      {
        tenantId: tenant.id,
        agentId: botTi.id,
        title: "Horário de atendimento",
        content: HOURS_TEXT,
      },
      {
        tenantId: tenant.id,
        agentId: botTi.id,
        title: "Ramais UNIESBAM",
        content: RAMAIS_TEXT,
      },
    ],
  });

  await prisma.flow.deleteMany({ where: { tenantId: tenant.id } });

  const flows: Array<{ name: string; trigger: string; graph: FlowGraph }> = [
    {
      name: "01 — Boas-vindas e menu TI",
      trigger: "oi|olá|ola|bom dia|boa tarde|boa noite|menu|inicio|início|começar|comecar|ajuda|hello|hi",
      graph: linearFlow([
        { id: "m1", label: "Menu principal", text: MENU_TEXT },
        { id: "m2", label: "Horário", text: HOURS_TEXT },
      ]),
    },
    {
      name: "02 — Portal do Aluno",
      trigger: "1|portal|portal do aluno",
      graph: linearFlow([{ id: "m1", label: "Portal", text: PORTAL_TEXT }], {
        transferHuman: true,
      }),
    },
    {
      name: "03 — Email Institucional",
      trigger: "2|email|e-mail|email institucional|institucional",
      graph: linearFlow([{ id: "m1", label: "Email", text: EMAIL_TEXT }], {
        transferHuman: true,
      }),
    },
    {
      name: "04 — Biblioteca Virtual",
      trigger: "3|biblioteca|biblioteca virtual",
      graph: linearFlow([{ id: "m1", label: "Biblioteca", text: BIBLIOTECA_TEXT }], {
        transferHuman: true,
      }),
    },
    {
      name: "05 — Atividades EAD/AVA",
      trigger: "4|ead|ava|atividades ead|atividades ava",
      graph: linearFlow([{ id: "m1", label: "EAD", text: EAD_TEXT }]),
    },
    {
      name: "06 — Outros assuntos (IA)",
      trigger: "5|outros|outro",
      graph: {
        nodes: [
          {
            id: "t1",
            type: "trigger",
            data: { label: "Gatilho" },
            position: { x: 40, y: 120 },
          },
          {
            id: "m1",
            type: "send_text",
            data: { label: "Outros", text: OUTROS_TEXT },
            position: { x: 280, y: 120 },
          },
          {
            id: "ai1",
            type: "ai_reply",
            data: { label: "BoTI", agentId: botTi.id },
            position: { x: 520, y: 120 },
          },
        ],
        edges: [
          { id: "e-t1-m1", source: "t1", target: "m1" },
          { id: "e-m1-ai1", source: "m1", target: "ai1" },
        ],
      },
    },
    {
      name: "07 — Ramais UNIESBAM",
      trigger: "ramal|ramais|telefone|telefones|contato|contatos|extensao|extensão",
      graph: linearFlow([{ id: "m1", label: "Ramais", text: RAMAIS_TEXT }]),
    },
    {
      name: "08 — Encerramento",
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
    {
      shortcut: "/menu",
      title: "Reenviar menu",
      content: MENU_TEXT,
    },
    {
      shortcut: "/horario",
      title: "Horário de atendimento",
      content: HOURS_TEXT,
    },
    {
      shortcut: "/ramais",
      title: "Lista de ramais",
      content: RAMAIS_TEXT,
    },
    {
      shortcut: "/portal",
      title: "Orientação Portal",
      content: PORTAL_TEXT,
    },
    {
      shortcut: "/email",
      title: "Orientação Email",
      content: EMAIL_TEXT,
    },
    {
      shortcut: "/encerrar",
      title: "Encerrar atendimento",
      content: CLOSE_TEXT,
    },
    {
      shortcut: "/aguardar",
      title: "Aguarde um momento",
      content:
        "Recebemos sua solicitação. Por favor, aguarde um momento enquanto verificamos — em breve um atendente do Setor de TI retorna. 👍",
    },
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
    users: team.map((u) => u.email),
  };
}
