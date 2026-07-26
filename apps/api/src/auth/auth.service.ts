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

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          slug,
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
          name: "Funil de Vendas",
        },
      });

      await tx.kanbanStage.createMany({
        data: [
          { tenantId: tenant.id, boardId: board.id, name: "Novo lead", order: 0 },
          { tenantId: tenant.id, boardId: board.id, name: "Orçamento", order: 1 },
          { tenantId: tenant.id, boardId: board.id, name: "Agendado", order: 2 },
          { tenantId: tenant.id, boardId: board.id, name: "Concluído", order: 3 },
          { tenantId: tenant.id, boardId: board.id, name: "Pago", order: 4 },
        ],
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
