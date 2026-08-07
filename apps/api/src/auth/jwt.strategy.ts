import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { UserRole } from "@bot-wpp/database";
import type { AuthUser } from "@bot-wpp/shared-types";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: AuthUser["role"];
  impersonating?: boolean;
  homeTenantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET") || process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.impersonating) {
      const owner = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          role: UserRole.PLATFORM_OWNER,
          active: true,
        },
        include: { tenant: true },
      });
      if (!owner) {
        throw new UnauthorizedException("Sessão de super admin inválida");
      }

      const target = await this.prisma.tenant.findUnique({
        where: { id: payload.tenantId },
      });
      if (!target) {
        throw new UnauthorizedException("Empresa alvo inválida");
      }

      return {
        id: owner.id,
        tenantId: target.id,
        email: owner.email,
        name: owner.name,
        role: "PLATFORM_OWNER",
        tenantSlug: target.slug,
        tenantName: target.name,
        impersonating: true,
        homeTenantId: owner.tenantId,
      };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        active: true,
      },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException("Usuário inválido ou inativo");
    }

    if (
      user.role !== UserRole.PLATFORM_OWNER &&
      user.tenant.billingStatus === "suspended"
    ) {
      throw new UnauthorizedException("Empresa suspensa. Contate o suporte GB Systems.");
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantSlug: user.tenant.slug,
      tenantName: user.tenant.name,
    };
  }
}
