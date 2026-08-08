import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Channel, PlanCode, UserRole } from "@bot-wpp/database";
import * as bcrypt from "bcryptjs";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { PrismaService } from "../prisma/prisma.service";

const execFileAsync = promisify(execFile);

const BOT_TI_PROMPT = `Você é o *BoTI*, assistente virtual do Setor de TI da UNIESBAM (Faculdade Esbam).
Responda em português do Brasil, de forma clara e objetiva.
Peça NOME COMPLETO + CPF quando for preciso abrir chamado humano.
Horário: seg–sex 07:30–21:50, sáb 08:00–11:50 (Manaus). E-mail: ti@esbam.edu.br`;

const MENDES_PROMPT =
  "Você é o Assistente Jurídico (IA Claude) do escritório Mendes & Associados. Identifique-se como sistema automatizado. Não dê parecer vinculante nem prometa resultado. Em dúvidas complexas, faça triagem e oriente consulta com advogado. Português do Brasil, profissional e objetivo.";

const GB_PROMPT =
  "Você é o assistente da GB Systems (Claude). Atenda com clareza em WhatsApp e Instagram, qualifique leads e encaminhe para um humano quando necessário. Português do Brasil.";

type ClaudeAgentSpec = {
  seedId: string;
  name: string;
  persona: string;
  systemPrompt: string;
};

function claudeSpecForTenant(tenant: { slug: string; name: string }): ClaudeAgentSpec {
  switch (tenant.slug) {
    case "ti-esbam":
      return {
        seedId: "seed-ai-agent-bot-ti",
        name: "BoTI",
        persona: "Assistente virtual do Setor de TI — UNIESBAM (Claude)",
        systemPrompt: BOT_TI_PROMPT,
      };
    case "mendes-advocacia":
      return {
        seedId: "seed-ai-agent-mendes-claude",
        name: "Assistente Jurídico",
        persona: "Assistente virtual jurídico com Claude",
        systemPrompt: MENDES_PROMPT,
      };
    case "demo":
    case "demo-gb":
      return {
        seedId: "seed-ai-agent-gb",
        name: "Assistente GB",
        persona: "Atendente omnichannel GB Systems (Claude)",
        systemPrompt: GB_PROMPT,
      };
    case "gb-systems":
      return {
        seedId: "seed-ai-agent-platform",
        name: "Assistente GB",
        persona: "Assistente da plataforma GB Systems (Claude)",
        systemPrompt: GB_PROMPT,
      };
    default:
      return {
        seedId: `seed-ai-agent-${tenant.slug}-claude`,
        name: `Assistente ${tenant.name}`,
        persona: `Assistente virtual — ${tenant.name} (Claude)`,
        systemPrompt: `Você é o assistente virtual de ${tenant.name}, powered by Claude. Responda em português do Brasil, de forma clara e profissional. Encaminhe para um atendente humano quando a solicitação for sensível ou exigir ação manual.`,
      };
  }
}

function isClaudeProvider(provider: string) {
  const p = provider.toLowerCase();
  return p.includes("anthropic") || p.includes("claude");
}

@Injectable()
export class AutoSeedService implements OnModuleInit {
  private readonly logger = new Logger(AutoSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      const users = await this.prisma.user.count();
      const enabled = (this.config.get<string>("RUN_SEED") ?? process.env.RUN_SEED ?? "true")
        .toString()
        .trim()
        .toLowerCase();

      if (users === 0) {
        if (enabled === "false" || enabled === "0" || enabled === "no") {
          this.logger.warn("Database empty but RUN_SEED disabled");
        } else {
          this.logger.warn("Database empty — running inline production seed…");
          await this.seedMinimal();
          this.logger.log("Inline seed completed");
        }
      } else {
        this.logger.log(`Base seed skipped — already have ${users} user(s)`);
      }

      // Sempre garante o cliente advocacia (idempotente), mesmo com DB já populado.
      await this.ensureAdvocaciaTenant();
      await this.ensureBoTiUsesClaude();
      await this.ensureClaudeAgentsForAllTenants();
    } catch (err) {
      this.logger.error(`Inline seed failed: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof Error && err.stack) this.logger.error(err.stack);
    }
  }

  /** Renomeia Bot Ti → BoTI e troca provedor para Claude (Anthropic). */
  private async ensureBoTiUsesClaude() {
    const agent = await this.prisma.aIAgent.findFirst({
      where: {
        OR: [{ id: "seed-ai-agent-bot-ti" }, { name: { in: ["Bot Ti", "BoTI"] } }],
      },
    });
    if (!agent) return;

    const alreadyClaude = agent.name === "BoTI" && isClaudeProvider(agent.modelProvider);
    if (alreadyClaude) return;

    await this.prisma.aIAgent.update({
      where: { id: agent.id },
      data: {
        name: "BoTI",
        modelProvider: "anthropic",
        persona: "Assistente virtual do Setor de TI — UNIESBAM (Claude)",
        systemPrompt: BOT_TI_PROMPT,
        active: true,
      },
    });
    this.logger.log("BoTI renomeado e conectado ao Claude");
  }

  /** Garante 1 agente Claude ativo por empresa (tenant). */
  private async ensureClaudeAgentsForAllTenants() {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    let created = 0;
    let updated = 0;

    for (const tenant of tenants) {
      const spec = claudeSpecForTenant(tenant);
      const agents = await this.prisma.aIAgent.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "asc" },
      });

      const bySeedId = agents.find((a) => a.id === spec.seedId);
      const claude = agents.find((a) => isClaudeProvider(a.modelProvider));
      const target = bySeedId ?? claude ?? agents[0];

      if (!target) {
        await this.prisma.aIAgent.create({
          data: {
            id: spec.seedId,
            tenantId: tenant.id,
            name: spec.name,
            persona: spec.persona,
            modelProvider: "anthropic",
            systemPrompt: spec.systemPrompt,
            active: true,
          },
        });
        created += 1;
        this.logger.log(`IA Claude criada — ${tenant.slug} (${spec.name})`);
        continue;
      }

      const nextName =
        target.name === "Bot Ti" ? "BoTI" : bySeedId || !isClaudeProvider(target.modelProvider)
          ? spec.name
          : target.name;
      const nextPrompt = target.systemPrompt?.trim() ? target.systemPrompt : spec.systemPrompt;
      const needsUpdate =
        !isClaudeProvider(target.modelProvider) ||
        !target.active ||
        target.name !== nextName ||
        (!target.systemPrompt?.trim() && Boolean(spec.systemPrompt));

      if (needsUpdate) {
        await this.prisma.aIAgent.update({
          where: { id: target.id },
          data: {
            name: nextName,
            persona: bySeedId || !isClaudeProvider(target.modelProvider) ? spec.persona : target.persona,
            modelProvider: "anthropic",
            systemPrompt: nextPrompt,
            active: true,
          },
        });
        updated += 1;
        this.logger.log(`IA Claude atualizada — ${tenant.slug} (${target.id})`);
      }
    }

    this.logger.log(
      `Claude por empresa: ${tenants.length} tenant(s), ${created} criado(s), ${updated} atualizado(s)`,
    );
  }

  private async ensureAdvocaciaTenant() {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: "mendes-advocacia" } });
    if (existing) {
      const flows = await this.prisma.flow.count({ where: { tenantId: existing.id } });
      const agents = await this.prisma.aIAgent.count({ where: { tenantId: existing.id, active: true } });
      if (flows > 0 && agents > 0) {
        this.logger.log("Cliente mendes-advocacia já configurado (fluxos + IA)");
        return;
      }
    }

    this.logger.warn("Provisioning Mendes & Associados Advocacia (Claude)…");
    const seedFile = join("/app/packages/database/prisma/run-seed-advocacia.ts");
    const tsxBin = [
      join("/app/node_modules/.bin/tsx"),
      join("/app/packages/database/node_modules/.bin/tsx"),
    ].find((p) => existsSync(p));

    if (tsxBin && existsSync(seedFile)) {
      try {
        const { stdout, stderr } = await execFileAsync(tsxBin, [seedFile], {
          cwd: "/app/packages/database",
          env: process.env,
          maxBuffer: 10 * 1024 * 1024,
        });
        if (stdout?.trim()) this.logger.log(stdout.trim());
        if (stderr?.trim()) this.logger.warn(stderr.trim());
        this.logger.log("Advocacia seed via tsx completed");
        return;
      } catch (err) {
        this.logger.error(`tsx advocacia seed failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Fallback: cria o mínimo inline (sem todos os textos longos dos fluxos do arquivo seed).
    await this.seedAdvocaciaInline();
  }

  private async seedAdvocaciaInline() {
    const passwordHash = await bcrypt.hash("admin123", 10);
    const firm = "Mendes & Associados Advocacia";
    const tenant = await this.prisma.tenant.upsert({
      where: { slug: "mendes-advocacia" },
      update: {
        name: firm,
        planId: "PRO",
        plan: PlanCode.PRO,
        billingStatus: "active",
        maxAgents: 12,
        maxInstances: 2,
        primaryColor: "#1B3A4B",
      },
      create: {
        name: firm,
        slug: "mendes-advocacia",
        planId: "PRO",
        plan: PlanCode.PRO,
        billingStatus: "active",
        maxAgents: 12,
        maxInstances: 2,
        maxInstagram: 0,
        maxContacts: 8000,
        primaryColor: "#1B3A4B",
        logoUrl: "/brand/gb-systems-logo.png",
      },
    });

    for (const member of [
      { email: "admin@mendesadvocacia.demo", name: "Dra. Ana Mendes", role: UserRole.ADMIN },
      { email: "atendimento@mendesadvocacia.demo", name: "Atendimento Mendes", role: UserRole.AGENT },
    ]) {
      await this.prisma.user.upsert({
        where: { email: member.email },
        update: { passwordHash, name: member.name, role: member.role, tenantId: tenant.id, active: true },
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

    const agent = await this.prisma.aIAgent.upsert({
      where: { id: "seed-ai-agent-mendes-claude" },
      update: {
        tenantId: tenant.id,
        name: "Assistente Jurídico",
        persona: "Assistente virtual jurídico com Claude",
        modelProvider: "anthropic",
        active: true,
        systemPrompt:
          "Você é o Assistente Jurídico (IA Claude) do escritório Mendes & Associados. Identifique-se como sistema automatizado. Não dê parecer vinculante nem prometa resultado. Em dúvidas complexas, faça triagem e oriente consulta com advogado. Português do Brasil, profissional e objetivo.",
      },
      create: {
        id: "seed-ai-agent-mendes-claude",
        tenantId: tenant.id,
        name: "Assistente Jurídico",
        persona: "Assistente virtual jurídico com Claude",
        modelProvider: "anthropic",
        active: true,
        systemPrompt:
          "Você é o Assistente Jurídico (IA Claude) do escritório Mendes & Associados. Identifique-se como sistema automatizado. Não dê parecer vinculante nem prometa resultado. Em dúvidas complexas, faça triagem e oriente consulta com advogado. Português do Brasil, profissional e objetivo.",
      },
    });

    const flowCount = await this.prisma.flow.count({ where: { tenantId: tenant.id } });
    if (flowCount === 0) {
      await this.prisma.flow.create({
        data: {
          tenantId: tenant.id,
          name: "01 — Menu advocacia",
          trigger: "oi|olá|ola|bom dia|menu|ajuda",
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
                  text: `Olá! Bem-vindo(a) à *${firm}*.\nSou o *assistente virtual* (automatizado).\n\n*1.* Novo atendimento\n*2.* Já sou cliente\n*3.* Áreas\n*4.* Honorários\n*5.* Urgente\n*7.* Dúvida complexa (IA Claude)\n*8.* Falar com advogado`,
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
          tenantId: tenant.id,
          name: "08 — IA Claude",
          trigger: "7|ia|claude|complexa",
          channel: Channel.WHATSAPP,
          active: true,
          nodes: {
            nodes: [
              { id: "t1", type: "trigger", data: { label: "Gatilho" }, position: { x: 40, y: 120 } },
              {
                id: "ai1",
                type: "ai_reply",
                data: { label: "Claude", agentId: agent.id },
                position: { x: 280, y: 120 },
              },
            ],
            edges: [{ id: "e1", source: "t1", target: "ai1" }],
          },
        },
      });
    }

    await this.prisma.businessHours.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        timezone: "America/Manaus",
        awayMessage: "Fora do horário humano (seg–sex 08:00–18:00). Digite menu para triagem.",
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

    this.logger.log(`Advocacia inline OK — portal /t/${tenant.slug}`);
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

    await this.prisma.aIAgent.upsert({
      where: { id: "seed-ai-agent-platform" },
      update: {
        tenantId: platform.id,
        name: "Assistente GB",
        persona: "Assistente da plataforma GB Systems (Claude)",
        modelProvider: "anthropic",
        active: true,
        systemPrompt: GB_PROMPT,
      },
      create: {
        id: "seed-ai-agent-platform",
        tenantId: platform.id,
        name: "Assistente GB",
        persona: "Assistente da plataforma GB Systems (Claude)",
        modelProvider: "anthropic",
        active: true,
        systemPrompt: GB_PROMPT,
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

    await this.prisma.aIAgent.upsert({
      where: { id: "seed-ai-agent-gb" },
      update: {
        tenantId: demo.id,
        name: "Assistente GB",
        persona: "Atendente omnichannel GB Systems (Claude)",
        modelProvider: "anthropic",
        active: true,
        systemPrompt: GB_PROMPT,
      },
      create: {
        id: "seed-ai-agent-gb",
        tenantId: demo.id,
        name: "Assistente GB",
        persona: "Atendente omnichannel GB Systems (Claude)",
        modelProvider: "anthropic",
        active: true,
        systemPrompt: GB_PROMPT,
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
        name: "BoTI",
        persona: "Assistente virtual do Setor de TI — UNIESBAM (Claude)",
        modelProvider: "anthropic",
        active: true,
        systemPrompt: BOT_TI_PROMPT,
      },
      create: {
        id: "seed-ai-agent-bot-ti",
        tenantId: ti.id,
        name: "BoTI",
        persona: "Assistente virtual do Setor de TI — UNIESBAM (Claude)",
        modelProvider: "anthropic",
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
                  text: "*SUPORTE-TI — UNIESBAM*\n\n1. Portal do Aluno\n2. Email Institucional\n3. Biblioteca Virtual\n4. EAD/AVA\n5. Outros (BoTI)\n\nDigite o número da opção.",
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
          name: "06 — Outros (IA BoTI)",
          trigger: "5|outros|outro",
          channel: Channel.WHATSAPP,
          active: true,
          nodes: {
            nodes: [
              { id: "t1", type: "trigger", data: { label: "Gatilho" }, position: { x: 40, y: 120 } },
              {
                id: "ai1",
                type: "ai_reply",
                data: { label: "BoTI", agentId: agent.id },
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
