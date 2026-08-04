import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@bot-wpp/database";
import type { UserRole as SharedRole } from "@bot-wpp/shared-types";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: SharedRole;
  active: boolean;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  listByTenant(tenantId: string): Promise<UserListItem[]> {
    return this.prisma.user.findMany({
      where: { tenantId, role: { not: UserRole.PLATFORM_OWNER } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(
    tenantId: string,
    data: { name: string; email: string; password: string; role: "ADMIN" | "SUPERVISOR" | "AGENT" },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Empresa não encontrada");

    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("E-mail já cadastrado");

    const count = await this.prisma.user.count({
      where: { tenantId, active: true, role: { not: UserRole.PLATFORM_OWNER } },
    });
    if (count >= tenant.maxAgents) {
      throw new ForbiddenException(`Limite de usuários atingido (${tenant.maxAgents})`);
    }

    if (data.password.length < 6) {
      throw new BadRequestException("Senha deve ter no mínimo 6 caracteres");
    }

    return this.prisma.user.create({
      data: {
        tenantId,
        email,
        name: data.name.trim(),
        passwordHash: await bcrypt.hash(data.password, 10),
        role: data.role as UserRole,
      },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
  }

  async update(
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
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
  }
}
