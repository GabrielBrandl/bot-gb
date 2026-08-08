import { PrismaClient, UserRole, Channel, PlanCode } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { seedTiEsbam } from "./seed-ti-esbam";
import { seedAdvocacia } from "./seed-advocacia";

const prisma = new PrismaClient();

const PLAN_FEATURES = {
  STARTER: [
    "1 número WhatsApp",
    "2 agentes",
    "Até 500 contatos",
    "Inbox unificado",
    "Automações básicas (3 fluxos)",
    "Kanban CRM",
    "Respostas rápidas",
    "Suporte por e-mail",
  ],
  PRO: [
    "Até 3 WhatsApp + 2 Instagram",
    "10 agentes",
    "Até 5.000 contatos",
    "Inbox omnichannel (WhatsApp + Instagram)",
    "Fluxos ilimitados + gatilhos por canal",
    "Agente de IA com base de conhecimento",
    "Campanhas e broadcasts",
    "Pagamentos ASAAS (Pix/boleto/cartão)",
    "Relatórios avançados",
    "Horário comercial + mensagem automática",
    "Suporte prioritário",
  ],
  ENTERPRISE: [
    "WhatsApp e Instagram ilimitados",
    "Agentes ilimitados",
    "Contatos ilimitados",
    "White-label (marca própria)",
    "IA multi-agente + handoff humano",
    "Campanhas omnichannel ilimitadas",
    "API e webhooks dedicados",
    "CSAT e auditoria completa",
    "Onboarding assistido",
    "SLA e gerente de sucesso",
  ],
} as const;

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.plan.upsert({
    where: { id: "STARTER" },
    update: {},
    create: {
      id: "STARTER",
      code: PlanCode.STARTER,
      name: "Starter",
      description: "Ideal para começar o atendimento digital com WhatsApp.",
      priceMonthly: 97,
      priceYearly: 970,
      maxAgents: 2,
      maxWhatsapp: 1,
      maxInstagram: 0,
      maxContacts: 500,
      maxFlows: 3,
      maxCampaigns: 0,
      aiEnabled: false,
      instagramEnabled: false,
      campaignsEnabled: false,
      paymentsEnabled: false,
      reportsEnabled: true,
      whiteLabel: false,
      prioritySupport: false,
      highlight: false,
      sortOrder: 1,
      features: [...PLAN_FEATURES.STARTER],
    },
  });

  await prisma.plan.upsert({
    where: { id: "PRO" },
    update: {},
    create: {
      id: "PRO",
      code: PlanCode.PRO,
      name: "Professional",
      description: "Omnichannel completo com IA, Instagram e campanhas.",
      priceMonthly: 297,
      priceYearly: 2970,
      maxAgents: 10,
      maxWhatsapp: 3,
      maxInstagram: 2,
      maxContacts: 5000,
      maxFlows: 100,
      maxCampaigns: 50,
      aiEnabled: true,
      instagramEnabled: true,
      campaignsEnabled: true,
      paymentsEnabled: true,
      reportsEnabled: true,
      whiteLabel: false,
      prioritySupport: true,
      highlight: true,
      sortOrder: 2,
      features: [...PLAN_FEATURES.PRO],
    },
  });

  await prisma.plan.upsert({
    where: { id: "ENTERPRISE" },
    update: {},
    create: {
      id: "ENTERPRISE",
      code: PlanCode.ENTERPRISE,
      name: "Enterprise",
      description: "Escala sem limites, white-label e suporte dedicado.",
      priceMonthly: 797,
      priceYearly: 7970,
      maxAgents: 999,
      maxWhatsapp: 999,
      maxInstagram: 999,
      maxContacts: 999999,
      maxFlows: 9999,
      maxCampaigns: 9999,
      aiEnabled: true,
      instagramEnabled: true,
      campaignsEnabled: true,
      paymentsEnabled: true,
      reportsEnabled: true,
      whiteLabel: true,
      prioritySupport: true,
      highlight: false,
      sortOrder: 3,
      features: [...PLAN_FEATURES.ENTERPRISE],
    },
  });

  const platformTenant = await prisma.tenant.upsert({
    where: { slug: "gb-systems" },
    update: {
      name: "GB Systems",
      planId: "ENTERPRISE",
      plan: "ENTERPRISE",
      primaryColor: "#2F6BFF",
      logoUrl: "/brand/gb-systems-logo.png",
      maxAgents: 999,
      maxInstances: 999,
      maxInstagram: 999,
      maxContacts: 999999,
      billingStatus: "active",
    },
    create: {
      name: "GB Systems",
      slug: "gb-systems",
      planId: "ENTERPRISE",
      plan: "ENTERPRISE",
      primaryColor: "#2F6BFF",
      logoUrl: "/brand/gb-systems-logo.png",
      maxAgents: 999,
      maxInstances: 999,
      maxInstagram: 999,
      maxContacts: 999999,
      billingStatus: "active",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@gbsystems.com.br" },
    update: {
      passwordHash,
      role: UserRole.PLATFORM_OWNER,
      name: "Owner GB Systems",
      active: true,
    },
    create: {
      tenantId: platformTenant.id,
      email: "admin@gbsystems.com.br",
      name: "Owner GB Systems",
      passwordHash,
      role: UserRole.PLATFORM_OWNER,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-gb" },
    update: {
      name: "Demo GB Systems",
      planId: "PRO",
      plan: "PRO",
      primaryColor: "#2F6BFF",
      logoUrl: "/brand/gb-systems-logo.png",
      maxAgents: 10,
      maxInstances: 3,
      maxInstagram: 2,
      maxContacts: 5000,
      billingStatus: "active",
    },
    create: {
      name: "Demo GB Systems",
      slug: "demo-gb",
      planId: "PRO",
      plan: "PRO",
      primaryColor: "#2F6BFF",
      logoUrl: "/brand/gb-systems-logo.png",
      maxAgents: 10,
      maxInstances: 3,
      maxInstagram: 2,
      maxContacts: 5000,
      billingStatus: "active",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const demoAdmin = await prisma.user.upsert({
    where: { email: "admin@demo.gbsystems.com.br" },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      name: "Admin Demo",
      active: true,
      tenantId: tenant.id,
    },
    create: {
      tenantId: tenant.id,
      email: "admin@demo.gbsystems.com.br",
      name: "Admin Demo",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {
      passwordHash,
      tenantId: tenant.id,
      role: UserRole.ADMIN,
      name: "Admin Demo",
    },
    create: {
      tenantId: tenant.id,
      email: "admin@demo.com",
      name: "Admin Demo",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  await prisma.businessHours.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      timezone: "America/Manaus",
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
      data: { tenantId: tenant.id, name: "Funil Omnichannel" },
    });
    await prisma.kanbanStage.createMany({
      data: [
        { tenantId: tenant.id, boardId: board.id, name: "Novo lead", order: 0 },
        { tenantId: tenant.id, boardId: board.id, name: "Qualificação", order: 1 },
        { tenantId: tenant.id, boardId: board.id, name: "Proposta", order: 2 },
        { tenantId: tenant.id, boardId: board.id, name: "Fechado", order: 3 },
      ],
    });
  }

  await prisma.whatsappInstance.upsert({
    where: {
      tenantId_evolutionInstanceId: {
        tenantId: tenant.id,
        evolutionInstanceId: "demo",
      },
    },
    update: { status: "connected", name: "WhatsApp GB (Demo)" },
    create: {
      tenantId: tenant.id,
      name: "WhatsApp GB (Demo)",
      evolutionInstanceId: "demo",
      phoneNumber: "5592999999999",
      status: "connected",
    },
  });

  await prisma.instagramAccount.upsert({
    where: {
      tenantId_igUserId: {
        tenantId: tenant.id,
        igUserId: "demo-ig",
      },
    },
    update: { status: "connected", name: "Instagram GB (Demo)", igUsername: "gbsystems.demo" },
    create: {
      tenantId: tenant.id,
      name: "Instagram GB (Demo)",
      igUserId: "demo-ig",
      igUsername: "gbsystems.demo",
      status: "connected",
    },
  });

  const agent = await prisma.aIAgent.upsert({
    where: { id: "seed-ai-agent-gb" },
    update: {
      name: "Assistente GB",
      persona: "Atendente omnichannel GB Systems",
      modelProvider: "openai",
      active: true,
      systemPrompt:
        "Você é o assistente da GB Systems. Atenda com clareza em WhatsApp e Instagram, qualifique leads e encaminhe para um humano quando necessário.",
    },
    create: {
      id: "seed-ai-agent-gb",
      tenantId: tenant.id,
      name: "Assistente GB",
      persona: "Atendente omnichannel GB Systems",
      modelProvider: "openai",
      active: true,
      systemPrompt:
        "Você é o assistente da GB Systems. Atenda com clareza em WhatsApp e Instagram, qualifique leads e encaminhe para um humano quando necessário.",
    },
  });

  await prisma.knowledgeDocument.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.knowledgeDocument.create({
    data: {
      tenantId: tenant.id,
      agentId: agent.id,
      title: "Sobre a GB Systems",
      content:
        "A GB Systems é uma plataforma omnichannel de atendimento e automação para WhatsApp e Instagram, com IA, CRM Kanban, campanhas e pagamentos.",
    },
  });

  await prisma.flow.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.flow.create({
    data: {
      tenantId: tenant.id,
      name: "Boas-vindas Omnichannel",
      trigger: "oi|olá|ola|bom dia|menu|hello",
      channel: null,
      active: true,
      nodes: {
        nodes: [
          {
            id: "t1",
            type: "trigger",
            data: { label: "Gatilho saudação" },
            position: { x: 80, y: 120 },
          },
          {
            id: "m1",
            type: "send_text",
            data: {
              label: "Boas-vindas",
              text: "Olá! Bem-vindo à GB Systems 🚀\nAtendimento omnichannel WhatsApp + Instagram.\nComo posso ajudar?",
            },
            position: { x: 320, y: 120 },
          },
          {
            id: "a1",
            type: "ai_reply",
            data: { label: "IA omnichannel" },
            position: { x: 560, y: 120 },
          },
        ],
        edges: [
          { id: "e1", source: "t1", target: "m1" },
          { id: "e2", source: "m1", target: "a1" },
        ],
      },
    },
  });

  await prisma.quickReply.upsert({
    where: { tenantId_shortcut: { tenantId: tenant.id, shortcut: "/ola" } },
    update: {
      title: "Saudação",
      content: "Olá! Sou da equipe GB Systems. Em que posso ajudar hoje?",
    },
    create: {
      tenantId: tenant.id,
      shortcut: "/ola",
      title: "Saudação",
      content: "Olá! Sou da equipe GB Systems. Em que posso ajudar hoje?",
    },
  });

  const tiEsbam = await seedTiEsbam(prisma, passwordHash);
  const advocacia = await seedAdvocacia(prisma, passwordHash);

  console.log("Seed OK — GB Systems Omnichannel");
  console.log("Platform owner: admin@gbsystems.com.br / admin123");
  console.log("Tenant demo: admin@demo.gbsystems.com.br / admin123");
  console.log("(também: admin@demo.com / admin123)");
  console.log("Demo admin id:", demoAdmin.id);
  console.log("---");
  console.log("Cliente TI Esbam (UNIESBAM):", tiEsbam.portal);
  console.log("Login equipe (senha admin123):");
  for (const email of tiEsbam.users) {
    console.log(`  - ${email}`);
  }
  console.log("Portal: http://localhost:5173/t/ti-esbam/login");
  console.log("---");
  console.log("Cliente Advocacia:", advocacia.firm, advocacia.portal);
  console.log("IA Claude:", advocacia.agentName, advocacia.agentId);
  console.log("Login equipe (senha admin123):");
  for (const email of advocacia.users) {
    console.log(`  - ${email}`);
  }
  console.log("Portal: http://localhost:5173/t/mendes-advocacia/login");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
