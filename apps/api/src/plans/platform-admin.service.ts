import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@bot-wpp/database";
import type { AuthResponse, AuthUser, BillingStatus, PlanCode } from "@bot-wpp/shared-types";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../common/utils/slugify";
import { PlansService } from "./plans.service";

type AccessCodeEntry = {
  ownerId: string;
  tenantId: string;
  slug: string;
  expiresAt: number;
};

const accessCodes = new Map<string, AccessCodeEntry>();

export interface CreateTenantInput {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  planId: PlanCode;
  maxAgents?: number;
  maxWhatsapp?: number;
  maxInstagram?: number;
  maxContacts?: number;
  billingStatus?: BillingStatus;
}

export interface UpdateTenantInput {
  name?: string;
  planId?: PlanCode;
  maxAgents?: number;
  maxWhatsapp?: number;
  maxInstagram?: number;
  maxContacts?: number;
  billingStatus?: BillingStatus;
  primaryColor?: string;
  logoUrl?: string;
}

export interface CreateTenantUserInput {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "SUPERVISOR" | "AGENT";
}

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly jwt: JwtService,
  ) {}

  async getPublicBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        billingStatus: true,
      },
    });
    if (!tenant || tenant.slug === "gb-systems") {
      return { found: false as const };
    }
    return {
      found: true as const,
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        suspended: tenant.billingStatus === "suspended",
      },
    };
  }

  async assertOwner(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.PLATFORM_OWNER) {
      throw new ForbiddenException("Acesso restrito ao Super Admin GB Systems");
    }
    return user;
  }

  async overview() {
    const [tenants, users, conversations, plans, suspended] = await Promise.all([
      this.prisma.tenant.count({ where: { slug: { not: "gb-systems" } } }),
      this.prisma.user.count({ where: { role: { not: UserRole.PLATFORM_OWNER } } }),
      this.prisma.conversation.count(),
      this.prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
      this.prisma.tenant.count({ where: { billingStatus: "suspended" } }),
    ]);

    const byPlan = await this.prisma.tenant.groupBy({
      by: ["plan"],
      _count: { _all: true },
      where: { slug: { not: "gb-systems" } },
    });

    return {
      metrics: { tenants, users, conversations, suspended },
      byPlan,
      plans: plans.map((p) => this.plans.serialize(p)),
    };
  }

  listTenants() {
    return this.prisma.tenant.findMany({
      where: { slug: { not: "gb-systems" } },
      orderBy: { createdAt: "desc" },
      include: {
        planRef: true,
        users: {
          select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
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

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, slug: { not: "gb-systems" } },
      include: {
        planRef: true,
        users: {
          select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        instances: true,
        instagramAccounts: true,
        _count: {
          select: {
            users: true,
            contacts: true,
            conversations: true,
            flows: true,
            campaigns: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException("Empresa não encontrada");
    return {
      ...tenant,
      portalUrl: `/t/${tenant.slug}`,
    };
  }

  async createTenant(input: CreateTenantInput) {
    const email = input.adminEmail.toLowerCase().trim();
    if (input.adminPassword.length < 6) {
      throw new BadRequestException("Senha do admin deve ter no mínimo 6 caracteres");
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("E-mail do admin já cadastrado");

    const plan = await this.plans.get(input.planId);
    const baseSlug = slugify(input.companyName);
    const slug = await this.ensureUniqueSlug(baseSlug);
    const passwordHash = await bcrypt.hash(input.adminPassword, 10);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.companyName.trim(),
          slug,
          planId: plan.id,
          plan: plan.code,
          maxAgents: input.maxAgents ?? plan.maxAgents,
          maxInstances: input.maxWhatsapp ?? plan.maxWhatsapp,
          maxInstagram: input.maxInstagram ?? plan.maxInstagram,
          maxContacts: input.maxContacts ?? plan.maxContacts,
          billingStatus: input.billingStatus ?? "trialing",
          trialEndsAt,
          primaryColor: "#2F6BFF",
          logoUrl: "/brand/gb-systems-logo.png",
        },
      });

      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name: input.adminName.trim(),
          passwordHash,
          role: UserRole.ADMIN,
        },
      });

      const board = await tx.kanbanBoard.create({
        data: { tenantId: tenant.id, name: "Funil Omnichannel" },
      });

      await tx.kanbanStage.createMany({
        data: [
          { tenantId: tenant.id, boardId: board.id, name: "Novo lead", order: 0 },
          { tenantId: tenant.id, boardId: board.id, name: "Qualificação", order: 1 },
          { tenantId: tenant.id, boardId: board.id, name: "Proposta", order: 2 },
          { tenantId: tenant.id, boardId: board.id, name: "Fechado", order: 3 },
        ],
      });

      await tx.businessHours.create({
        data: {
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

      return { tenant, admin };
    });

    return {
      tenant: await this.getTenant(result.tenant.id),
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        name: result.admin.name,
        role: result.admin.role,
      },
      portalUrl: `/t/${result.tenant.slug}`,
      credentials: {
        email,
        temporaryPassword: input.adminPassword,
      },
    };
  }

  async updateTenant(tenantId: string, input: UpdateTenantInput) {
    await this.getTenant(tenantId);

    let planData: Record<string, unknown> = {};
    if (input.planId) {
      const plan = await this.plans.get(input.planId);
      planData = {
        planId: plan.id,
        plan: plan.code,
        maxAgents: input.maxAgents ?? plan.maxAgents,
        maxInstances: input.maxWhatsapp ?? plan.maxWhatsapp,
        maxInstagram: input.maxInstagram ?? plan.maxInstagram,
        maxContacts: input.maxContacts ?? plan.maxContacts,
      };
    } else {
      if (input.maxAgents !== undefined) planData.maxAgents = input.maxAgents;
      if (input.maxWhatsapp !== undefined) planData.maxInstances = input.maxWhatsapp;
      if (input.maxInstagram !== undefined) planData.maxInstagram = input.maxInstagram;
      if (input.maxContacts !== undefined) planData.maxContacts = input.maxContacts;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.billingStatus ? { billingStatus: input.billingStatus } : {}),
        ...(input.primaryColor ? { primaryColor: input.primaryColor } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...planData,
      },
    });

    return this.getTenant(tenantId);
  }

  async setTenantStatus(tenantId: string, billingStatus: string) {
    await this.getTenant(tenantId);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { billingStatus },
    });
    return this.getTenant(tenantId);
  }

  async updateTenantPlan(tenantId: string, planId: string) {
    return this.updateTenant(tenantId, { planId: planId as PlanCode });
  }

  async createUser(tenantId: string, input: CreateTenantUserInput) {
    const tenant = await this.getTenant(tenantId);
    const email = input.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("E-mail já cadastrado");

    const agentCount = await this.prisma.user.count({
      where: { tenantId, role: { in: [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN] }, active: true },
    });
    if (agentCount >= tenant.maxAgents) {
      throw new ForbiddenException(`Limite de usuários do plano atingido (${tenant.maxAgents})`);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        tenantId,
        email,
        name: input.name.trim(),
        passwordHash,
        role: input.role as UserRole,
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
  }

  async updateUser(
    tenantId: string,
    userId: string,
    data: { name?: string; role?: "ADMIN" | "SUPERVISOR" | "AGENT"; active?: boolean; password?: string },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, role: { not: UserRole.PLATFORM_OWNER } },
    });
    if (!user) throw new NotFoundException("Usuário não encontrado");

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.role ? { role: data.role as UserRole } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
  }

  async impersonate(ownerId: string, tenantId: string): Promise<AuthResponse> {
    const owner = await this.assertOwner(ownerId);
    const tenant = await this.getTenant(tenantId);

    const user: AuthUser = {
      id: owner.id,
      tenantId: tenant.id,
      email: owner.email,
      name: owner.name,
      role: "PLATFORM_OWNER",
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      impersonating: true,
      homeTenantId: owner.tenantId,
    };

    return {
      accessToken: this.jwt.sign({
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        impersonating: true,
        homeTenantId: owner.tenantId,
      }),
      user,
    };
  }

  /** One-time code so Super Admin can open the company portal in a new tab without replacing their session. */
  async createAccessLink(ownerId: string, tenantId: string) {
    await this.assertOwner(ownerId);
    const tenant = await this.getTenant(tenantId);
    const code = `gb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    accessCodes.set(code, {
      ownerId,
      tenantId: tenant.id,
      slug: tenant.slug,
      expiresAt: Date.now() + 2 * 60 * 1000,
    });
    return {
      code,
      slug: tenant.slug,
      path: `/t/${tenant.slug}/acesso?code=${encodeURIComponent(code)}`,
      expiresInSeconds: 120,
    };
  }

  async exchangeAccessCode(code: string): Promise<AuthResponse> {
    const entry = accessCodes.get(code);
    if (!entry) {
      throw new UnauthorizedException("Link de acesso inválido ou já usado");
    }
    accessCodes.delete(code);
    if (Date.now() > entry.expiresAt) {
      throw new UnauthorizedException("Link de acesso expirado. Gere outro no Super Admin.");
    }
    return this.impersonate(entry.ownerId, entry.tenantId);
  }

  async stopImpersonation(ownerId: string): Promise<AuthResponse> {
    const owner = await this.assertOwner(ownerId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: owner.tenantId } });
    if (!tenant) throw new UnauthorizedException("Tenant do owner não encontrado");

    const user: AuthUser = {
      id: owner.id,
      tenantId: owner.tenantId,
      email: owner.email,
      name: owner.name,
      role: "PLATFORM_OWNER",
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      impersonating: false,
    };

    return {
      accessToken: this.jwt.sign({
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
      }),
      user,
    };
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let slug = base || "empresa";
    let suffix = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }
}
