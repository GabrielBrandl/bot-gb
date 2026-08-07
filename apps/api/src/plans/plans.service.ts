import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async get(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException("Plano não encontrado");
    return plan;
  }

  /** Self-service: só STARTER/PRO em trial. ENTERPRISE e billing ativo = Super Admin. */
  async applyToTenant(
    tenantId: string,
    planId: string,
    options?: { fromPlatform?: boolean; activateBilling?: boolean },
  ) {
    const plan = await this.get(planId);
    if (!options?.fromPlatform && plan.code === "ENTERPRISE") {
      throw new BadRequestException(
        "Plano Enterprise só pode ser ativado pelo Super Admin GB Systems.",
      );
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: plan.id,
        plan: plan.code,
        maxAgents: plan.maxAgents,
        maxInstances: plan.maxWhatsapp,
        maxInstagram: plan.maxInstagram,
        maxContacts: plan.maxContacts,
        billingStatus: options?.activateBilling || options?.fromPlatform ? "active" : "trialing",
      },
      include: { planRef: true },
    });
  }

  serialize(plan: Awaited<ReturnType<PlansService["get"]>>) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceMonthly: Number(plan.priceMonthly),
      priceYearly: Number(plan.priceYearly),
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
      reportsEnabled: plan.reportsEnabled,
      whiteLabel: plan.whiteLabel,
      prioritySupport: plan.prioritySupport,
      features: Array.isArray(plan.features) ? plan.features : [],
      highlight: plan.highlight,
      sortOrder: plan.sortOrder,
    };
  }
}
