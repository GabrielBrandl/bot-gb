import { Injectable } from "@nestjs/common";
import type { UserRole } from "@bot-wpp/shared-types";
import { PrismaService } from "../prisma/prisma.service";

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  listByTenant(tenantId: string): Promise<UserListItem[]> {
    return this.prisma.user.findMany({
      where: { tenantId },
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
}
