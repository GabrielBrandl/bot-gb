import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class QuickRepliesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.quickReply.findMany({
      where: { tenantId },
      orderBy: { shortcut: "asc" },
    });
  }

  async create(tenantId: string, data: { shortcut: string; title: string; content: string }) {
    try {
      return await this.prisma.quickReply.create({ data: { tenantId, ...data } });
    } catch {
      throw new ConflictException("Já existe uma resposta rápida com este atalho");
    }
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<{ shortcut: string; title: string; content: string }>,
  ) {
    await this.ensureExists(tenantId, id);
    return this.prisma.quickReply.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.ensureExists(tenantId, id);
    await this.prisma.quickReply.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureExists(tenantId: string, id: string) {
    const item = await this.prisma.quickReply.findFirst({ where: { id, tenantId } });
    if (!item) {
      throw new NotFoundException("Resposta rápida não encontrada");
    }
    return item;
  }
}
