import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        plan: true,
        maxAgents: true,
        maxInstances: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException("Empresa não encontrada");
    }

    return tenant;
  }

  async update(
    tenantId: string,
    data: Partial<{ name: string; logoUrl: string; primaryColor: string; plan: string }>,
  ) {
    await this.getById(tenantId);
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        plan: true,
        maxAgents: true,
        maxInstances: true,
        createdAt: true,
      },
    });
  }
}
