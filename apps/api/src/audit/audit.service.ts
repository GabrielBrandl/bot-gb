import { Injectable } from "@nestjs/common";
import { Prisma } from "@bot-wpp/database";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditLogInput {
  tenantId: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        meta: input.meta,
      },
    });
  }

  list(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
  }

  count(tenantId: string) {
    return this.prisma.auditLog.count({ where: { tenantId } });
  }
}
