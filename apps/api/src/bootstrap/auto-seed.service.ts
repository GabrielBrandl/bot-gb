import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Channel, PlanCode, UserRole } from "@bot-wpp/database";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

const BOT_TI_PROMPT = `Você é o *Bot Ti*, assistente virtual do Setor de TI da UNIESBAM (Faculdade Esbam).
Responda em português do Brasil, de forma clara e objetiva.
Peça NOME COMPLETO + CPF quando for preciso abrir chamado humano.
Horário: seg–sex 07:30–21:50, sáb 08:00–11:50 (Manaus). E-mail: ti@esbam.edu.br`;

@Injectable()
export class AutoSeedService implements OnModuleInit {
  private readonly logger = new Logger(AutoSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const enabled = (this.config.get<string>("RUN_SEED") ?? process.env.RUN_SEED ?? "false")
      .toString()
      .toLowerCase();
    if (enabled !== "true" && enabled !== "1") return;

    try {
      const users = await this.prisma.user.count();
      if (users > 0) {
        this.logger.log(`Seed skipped — already have ${users} user(s)`);
        return;
      }
      this.logger.warn("Database empty — running inline production seed…");
      await this.seedMinimal();
      this.logger.log("Inline seed completed");
    } catch (err) {
      this.logger.error(`Inline seed failed: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof Error && err.stack) this.logger.error(err.stack);
    }
  }

  private async seedMinimal() {
    const passwordHash = await bcrypt.hash("admin123", 10);

    const plans = [
      {
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
        features: ["Inbox", "WhatsApp", "Kanban"],
        sortOrder: 1,
      },
      {
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
        features: ["Inbox omnichannel", "IA", "Campanhas"],
        sortOrder: 2,
        highlight: true,
        prioritySupport: true,
      },
      {
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
        whiteLabel: true,
        prioritySupport: true,
        features: ["Ilimitado", "White-label"],
        sortOrder: 3,
      },
    ] as const;

    for (const plan of plans) {
      await this.prisma.plan.upsert({
        where: { id: plan.id },
        update: {},
        create: {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          maxAgents: plan.maxAgents,
          maxWhatsapp: plan.maxWhatsapp,
          maxInstagram: plan.maxInstagram,
          maxContacts: plan.maxContacts,
          maxFlows: plan.maxFlows,
          maxCampaigns: plan.maxCampaigns,
          aiEnabled: plan.aiEnabled,
          instagramEnabled: plan.instagramEnabled,
          campaignsEnabled: plan.campaignsEnabled,
          paymentsEnabled: plan.paymentsEnabled,
          reportsEnabled: true,
          whiteLabel: "whiteLabel" in plan ? Boolean(plan.whiteLabel) : false,
          prioritySupport: "prioritySupport" in plan ? Boolean(plan.prioritySupport) : false,
          highlight: "highlight" in plan ? Boolean(plan.highlight) : false,
          sortOrder: plan.sortOrder,
          features: [...plan.features],
        },
      });
    }

    const platform = await this.prisma.tenant.upsert({
      where: { slug: "gb-systems" },
      update: {},
      create: {
        name: "GB Systems",
        slug: "gb-systems",
        planId: "ENTERPRISE",
        plan: PlanCode.ENTERPRISE,
        maxAgents: 100,
        maxInstances: 50,
        maxInstagram: 50,
        maxContacts: 100000,
        billingStatus: "active",
      },
    });

    await this.prisma.user.upsert({
      where: { email: "admin@gbsystems.com.br" },
      update: { passwordHash, active: true, role: UserRole.PLATFORM_OWNER },
      create: {
        tenantId: platform.id,
        email: "admin@gbsystems.com.br",
        name: "Super Admin GB",
        passwordHash,
        role: UserRole.PLATFORM_OWNER,
        active: true,
      },
    });

    const demo = await this.prisma.tenant.upsert({
      where: { slug: "demo" },
      update: {},
      create: {
        name: "Demo GB Systems",
        slug: "demo",
        planId: "PRO",
        plan: PlanCode.PRO,
        maxAgents: 10,
        maxInstances: 3,
        maxInstagram: 2,
        maxContacts: 5000,
        billingStatus: "active",
      },
    });

    await this.prisma.user.upsert({
      where: { email: "admin@demo.gbsystems.com.br" },
      update: { passwordHash, active: true, role: UserRole.ADMIN },
      create: {
        tenantId: demo.id,
        email: "admin@demo.gbsystems.com.br",
        name: "Admin Demo",
        passwordHash,
        role: UserRole.ADMIN,
        active: true,
      },
    });

    const ti = await this.prisma.tenant.upsert({
      where: { slug: "ti-esbam" },
      update: {
        name: "TI Esbam — UNIESBAM",
        planId: "ENTERPRISE",
        plan: PlanCode.ENTERPRISE,
        billingStatus: "active",
        maxAgents: 15,
        maxInstances: 1,
      },
      create: {
        name: "TI Esbam — UNIESBAM",
        slug: "ti-esbam",
        planId: "ENTERPRISE",
        plan: PlanCode.ENTERPRISE,
        maxAgents: 15,
        maxInstances: 1,
        maxInstagram: 0,
        maxContacts: 10000,
        billingStatus: "active",
      },
    });

    const team = [
      { email: "ti.esbam@gmail.com", name: "Admin TI Esbam", role: UserRole.ADMIN },
      { email: "maura.ti.esbam@gmail.com", name: "Maura", role: UserRole.SUPERVISOR },
      { email: "atendente1.ti.esbam@gmail.com", name: "Atendente TI 1", role: UserRole.AGENT },
    ];

    for (const member of team) {
      await this.prisma.user.upsert({
        where: { email: member.email },
        update: { passwordHash, name: member.name, role: member.role, tenantId: ti.id, active: true },
        create: {
          tenantId: ti.id,
          email: member.email,
          name: member.name,
          passwordHash,
          role: member.role,
          active: true,
        },
      });
    }

    await this.prisma.businessHours.upsert({
      where: { tenantId: ti.id },
      update: {
        timezone: "America/Manaus",
        awayMessage:
          "No momento estamos fora do horário de atendimento do Setor de TI. Retornaremos em breve.",
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
        tenantId: ti.id,
        timezone: "America/Manaus",
        awayMessage:
          "No momento estamos fora do horário de atendimento do Setor de TI. Retornaremos em breve.",
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

    const agent = await this.prisma.aIAgent.upsert({
      where: { id: "seed-ai-agent-bot-ti" },
      update: {
        tenantId: ti.id,
        name: "Bot Ti",
        persona: "Assistente virtual do Setor de TI — UNIESBAM",
        modelProvider: "openai",
        active: true,
        systemPrompt: BOT_TI_PROMPT,
      },
      create: {
        id: "seed-ai-agent-bot-ti",
        tenantId: ti.id,
        name: "Bot Ti",
        persona: "Assistente virtual do Setor de TI — UNIESBAM",
        modelProvider: "openai",
        active: true,
        systemPrompt: BOT_TI_PROMPT,
      },
    });

    const existingFlows = await this.prisma.flow.count({ where: { tenantId: ti.id } });
    if (existingFlows === 0) {
      await this.prisma.flow.create({
        data: {
          tenantId: ti.id,
          name: "01 — Boas-vindas TI",
          trigger: "oi|olá|ola|bom dia|boa tarde|boa noite|menu|ajuda",
          channel: Channel.WHATSAPP,
          active: true,
          nodes: {
            nodes: [
              { id: "t1", type: "trigger", data: { label: "Gatilho" }, position: { x: 40, y: 120 } },
              {
                id: "m1",
                type: "send_text",
                data: {
                  label: "Menu",
                  text: "*SUPORTE-TI — UNIESBAM*\n\n1. Portal do Aluno\n2. Email Institucional\n3. Biblioteca Virtual\n4. EAD/AVA\n5. Outros (Bot Ti)\n\nDigite o número da opção.",
                },
                position: { x: 280, y: 120 },
              },
            ],
            edges: [{ id: "e1", source: "t1", target: "m1" }],
          },
        },
      });

      await this.prisma.flow.create({
        data: {
          tenantId: ti.id,
          name: "06 — Outros (IA Bot Ti)",
          trigger: "5|outros|outro",
          channel: Channel.WHATSAPP,
          active: true,
          nodes: {
            nodes: [
              { id: "t1", type: "trigger", data: { label: "Gatilho" }, position: { x: 40, y: 120 } },
              {
                id: "ai1",
                type: "ai_reply",
                data: { label: "Bot Ti", agentId: agent.id },
                position: { x: 280, y: 120 },
              },
            ],
            edges: [{ id: "e1", source: "t1", target: "ai1" }],
          },
        },
      });
    }
  }
}
