import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.flow.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getOne(tenantId: string, id: string) {
    const flow = await this.prisma.flow.findFirst({ where: { id, tenantId } });
    if (!flow) {
      throw new NotFoundException("Fluxo não encontrado");
    }
    return flow;
  }

  create(
    tenantId: string,
    data: { name: string; trigger: string; nodes: object; active?: boolean },
  ) {
    return this.prisma.flow.create({
      data: {
        tenantId,
        name: data.name,
        trigger: data.trigger,
        nodes: data.nodes,
        active: data.active ?? true,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<{ name: string; trigger: string; nodes: object; active: boolean }>,
  ) {
    await this.getOne(tenantId, id);
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.trigger !== undefined) payload.trigger = data.trigger;
    if (data.nodes !== undefined) payload.nodes = data.nodes;
    if (data.active !== undefined) payload.active = data.active;
    return this.prisma.flow.update({ where: { id }, data: payload });
  }

  async remove(tenantId: string, id: string) {
    await this.getOne(tenantId, id);
    await this.prisma.flow.delete({ where: { id } });
    return { ok: true };
  }
}
