import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ABS_DIAGNOSIS_PROMPT = `Você é o Assistente Técnico de Diagnóstico Visual da ABS Resolve Já — plataforma brasileira de serviços residenciais (elétrica, hidráulica, montagem, ar-condicionado, jardinagem e limpeza pós-obra).

Sua função: analisar fotos e informações enviadas pelo cliente e identificar o produto, equipamento ou problema, estimar a complexidade do serviço e sugerir respostas para o questionário de agendamento — sem inventar informações que não estejam evidentes.

Tom de voz: claro, profissional, acessível ao cliente leigo. Linguagem em português do Brasil.

Quando não tiver certeza, diga isso claramente e ofereça transferir para um atendente humano.
Sempre incentive o agendamento do serviço adequado (elétrica, hidráulica, montagem, ar-condicionado, jardinagem ou limpeza pós-obra).`;

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "abs-resolve" },
    update: {
      name: "ABS Resolve Já",
      primaryColor: "#0033B5",
      plan: "PRO",
      maxAgents: 20,
      maxInstances: 5,
    },
    create: {
      name: "ABS Resolve Já",
      slug: "abs-resolve",
      primaryColor: "#0033B5",
      plan: "PRO",
      maxAgents: 20,
      maxInstances: 5,
    },
  });

  // Keep legacy demo login working by also upserting demo tenant user if needed
  await prisma.user.upsert({
    where: { email: "admin@absresolve.com" },
    update: {
      name: "Admin ABS",
      passwordHash,
      role: UserRole.ADMIN,
      tenantId: tenant.id,
    },
    create: {
      email: "admin@absresolve.com",
      name: "Admin ABS",
      passwordHash,
      role: UserRole.ADMIN,
      tenantId: tenant.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {
      name: "Admin ABS",
      passwordHash,
      role: UserRole.ADMIN,
      tenantId: tenant.id,
    },
    create: {
      email: "admin@demo.com",
      name: "Admin ABS",
      passwordHash,
      role: UserRole.ADMIN,
      tenantId: tenant.id,
    },
  });

  await prisma.whatsappInstance.upsert({
    where: {
      tenantId_evolutionInstanceId: {
        tenantId: tenant.id,
        evolutionInstanceId: "demo-local",
      },
    },
    update: {
      name: "WhatsApp ABS (Demo)",
      status: "connected",
    },
    create: {
      tenantId: tenant.id,
      name: "WhatsApp ABS (Demo)",
      evolutionInstanceId: "demo-local",
      status: "connected",
    },
  });

  let board = await prisma.kanbanBoard.findFirst({
    where: { tenantId: tenant.id, name: "Funil de Serviços" },
  });

  if (!board) {
    board = await prisma.kanbanBoard.create({
      data: { tenantId: tenant.id, name: "Funil de Serviços" },
    });
  }

  const stageCount = await prisma.kanbanStage.count({ where: { boardId: board.id } });
  if (stageCount === 0) {
    await prisma.kanbanStage.createMany({
      data: [
        { tenantId: tenant.id, boardId: board.id, name: "Novo lead", order: 0 },
        { tenantId: tenant.id, boardId: board.id, name: "Diagnóstico", order: 1 },
        { tenantId: tenant.id, boardId: board.id, name: "Orçamento", order: 2 },
        { tenantId: tenant.id, boardId: board.id, name: "Agendado", order: 3 },
        { tenantId: tenant.id, boardId: board.id, name: "Concluído", order: 4 },
        { tenantId: tenant.id, boardId: board.id, name: "Pago", order: 5 },
      ],
    });
  }

  const agent = await prisma.aIAgent.findFirst({
    where: { tenantId: tenant.id, name: "Diagnóstico Visual ABS" },
  });

  const agentId =
    agent?.id ??
    (
      await prisma.aIAgent.create({
        data: {
          tenantId: tenant.id,
          name: "Diagnóstico Visual ABS",
          persona: "Assistente técnico de diagnóstico para serviços residenciais ABS Resolve Já",
          modelProvider: "openai",
          systemPrompt: ABS_DIAGNOSIS_PROMPT,
          active: true,
        },
      })
    ).id;

  const docCount = await prisma.knowledgeDocument.count({
    where: { tenantId: tenant.id, agentId },
  });

  if (docCount === 0) {
    await prisma.knowledgeDocument.create({
      data: {
        tenantId: tenant.id,
        agentId,
        title: "Serviços ABS Resolve",
        content: `
ABS Resolve Já atende: elétrica, hidráulica, montagem de móveis, ar-condicionado, jardinagem e limpeza pós-obra.
Fluxo típico: cliente envia foto/problema → diagnóstico → orçamento → agendamento → execução → pagamento (Pix, boleto ou cartão via ASAAS).
Horário comercial padrão: segunda a sábado. Emergências elétricas/hidráulicas podem ter taxa diferenciada.
Nunca inventar peças ou modelos não visíveis. Se a foto for insuficiente, pedir ângulo melhor ou transferir para humano.
        `.trim(),
        chunks: {
          create: [
            {
              tenantId: tenant.id,
              content:
                "Serviços: elétrica, hidráulica, montagem, ar-condicionado, jardinagem, limpeza pós-obra.",
              embedding: [],
            },
            {
              tenantId: tenant.id,
              content:
                "Pagamentos aceitos: Pix, boleto e cartão via ASAAS. Link pode ser enviado no WhatsApp.",
              embedding: [],
            },
          ],
        },
      },
    });
  }

  const flow = await prisma.flow.findFirst({
    where: { tenantId: tenant.id, name: "Boas-vindas ABS" },
  });

  if (!flow) {
    await prisma.flow.create({
      data: {
        tenantId: tenant.id,
        name: "Boas-vindas ABS",
        trigger: "oi|olá|ola|bom dia|boa tarde|menu",
        active: true,
        nodes: {
          nodes: [
            {
              id: "t1",
              type: "trigger",
              position: { x: 80, y: 120 },
              data: { label: "Gatilho saudação", keyword: "oi" },
            },
            {
              id: "m1",
              type: "send_text",
              position: { x: 320, y: 120 },
              data: {
                label: "Mensagem boas-vindas",
                text: "Olá! Sou o atendimento da ABS Resolve Já 🔧\n\nComo posso ajudar?\n1 - Elétrica\n2 - Hidráulica\n3 - Montagem\n4 - Ar-condicionado\n5 - Falar com atendente",
              },
            },
            {
              id: "a1",
              type: "ai_reply",
              position: { x: 560, y: 120 },
              data: { label: "IA diagnóstico", agentId },
            },
          ],
          edges: [
            { id: "e1", source: "t1", target: "m1" },
            { id: "e2", source: "m1", target: "a1" },
          ],
        },
      },
    });
  }

  await prisma.quickReply.upsert({
    where: { tenantId_shortcut: { tenantId: tenant.id, shortcut: "/orcamento" } },
    update: {},
    create: {
      tenantId: tenant.id,
      shortcut: "/orcamento",
      title: "Solicitar orçamento",
      content:
        "Perfeito! Para montar o orçamento, me envie uma foto do local/equipamento e o endereço aproximado.",
    },
  });

  console.log("Seed OK — ABS Resolve Já");
  console.log("Login: admin@absresolve.com / admin123");
  console.log("(também: admin@demo.com / admin123)");
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
