import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  async create(tenantId: string, data: { name: string; color?: string }) {
    try {
      return await this.prisma.tag.create({
        data: { tenantId, name: data.name, color: data.color ?? "#3B82F6" },
      });
    } catch {
      throw new ConflictException("Já existe uma tag com este nome");
    }
  }

  async update(tenantId: string, id: string, data: { name?: string; color?: string }) {
    await this.ensureExists(tenantId, id);
    return this.prisma.tag.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.ensureExists(tenantId, id);
    await this.prisma.tag.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureExists(tenantId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id, tenantId } });
    if (!tag) {
      throw new NotFoundException("Tag não encontrada");
    }
    return tag;
  }
}
