import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@bot-wpp/database";
import type { AuthResponse, AuthUser } from "@bot-wpp/shared-types";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { slugify } from "../common/utils/slugify";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("E-mail já cadastrado");
    }

    const slug = await this.ensureUniqueTenantSlug(slugify(dto.tenantName));
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const planId = dto.planId ?? "STARTER";
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new ConflictException("Plano inválido");
    }

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          slug,
          planId: plan.id,
          plan: plan.code,
          maxAgents: plan.maxAgents,
          maxInstances: plan.maxWhatsapp,
          maxInstagram: plan.maxInstagram,
          maxContacts: plan.maxContacts,
          primaryColor: "#2F6BFF",
          logoUrl: "/brand/gb-systems-logo.png",
          billingStatus: "trialing",
          trialEndsAt,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name: dto.name,
          passwordHash,
          role: UserRole.ADMIN,
        },
      });

      const board = await tx.kanbanBoard.create({
        data: {
          tenantId: tenant.id,
          name: "Funil Omnichannel",
        },
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

      return user;
    });

    return this.buildAuthResponse(result);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string, tenantId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, active: true },
    });

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado");
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  private buildAuthResponse(user: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: AuthUser["role"];
  }): AuthResponse {
    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
      }),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  private async ensureUniqueTenantSlug(base: string): Promise<string> {
    let slug = base || "empresa";
    let suffix = 1;

    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }
}
