import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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

  async applyToTenant(tenantId: string, planId: string) {
    const plan = await this.get(planId);
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: plan.id,
        plan: plan.code,
        maxAgents: plan.maxAgents,
        maxInstances: plan.maxWhatsapp,
        maxInstagram: plan.maxInstagram,
        maxContacts: plan.maxContacts,
        billingStatus: "active",
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

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwner(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "PLATFORM_OWNER") {
      throw new ForbiddenException("Acesso restrito ao painel GB Systems");
    }
    return user;
  }

  async overview() {
    const [tenants, users, conversations, plans] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count(),
      this.prisma.conversation.count(),
      this.prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

    const byPlan = await this.prisma.tenant.groupBy({
      by: ["plan"],
      _count: { _all: true },
    });

    const recentTenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        planRef: true,
        _count: { select: { users: true, conversations: true, contacts: true } },
      },
    });

    return {
      metrics: { tenants, users, conversations },
      byPlan,
      plans: plans.map((p) => ({
        ...p,
        priceMonthly: Number(p.priceMonthly),
        priceYearly: Number(p.priceYearly),
        features: Array.isArray(p.features) ? p.features : [],
      })),
      recentTenants,
    };
  }

  listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        planRef: true,
        _count: {
          select: {
            users: true,
            contacts: true,
            conversations: true,
            instances: true,
            instagramAccounts: true,
          },
        },
      },
    });
  }

  async updateTenantPlan(tenantId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plano não encontrado");

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: plan.id,
        plan: plan.code,
        maxAgents: plan.maxAgents,
        maxInstances: plan.maxWhatsapp,
        maxInstagram: plan.maxInstagram,
        maxContacts: plan.maxContacts,
        billingStatus: "active",
      },
      include: { planRef: true },
    });
  }

  async setTenantStatus(tenantId: string, billingStatus: string) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { billingStatus },
    });
  }
}
