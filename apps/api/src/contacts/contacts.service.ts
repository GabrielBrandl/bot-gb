import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, filters: { search?: string; tagId?: string }) {
    return this.prisma.contact.findMany({
      where: {
        tenantId,
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { phone: { contains: filters.search } },
              ],
            }
          : {}),
        ...(filters.tagId ? { tags: { some: { id: filters.tagId } } } : {}),
      },
      include: { tags: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getOne(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: { tags: true, conversations: { orderBy: { updatedAt: "desc" }, take: 5 } },
    });
    if (!contact) {
      throw new NotFoundException("Contato não encontrado");
    }
    return contact;
  }

  async create(tenantId: string, data: { phone: string; name?: string }) {
    const phone = data.phone.replace(/\D/g, "");
    try {
      return await this.prisma.contact.create({
        data: { tenantId, phone, name: data.name },
        include: { tags: true },
      });
    } catch {
      throw new ConflictException("Já existe um contato com este telefone");
    }
  }

  async update(
    tenantId: string,
    id: string,
    data: { name?: string; customFields?: Record<string, unknown> },
  ) {
    await this.getOne(tenantId, id);
    return this.prisma.contact.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.customFields !== undefined
          ? { customFields: data.customFields as object }
          : {}),
      },
      include: { tags: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.getOne(tenantId, id);
    await this.prisma.contact.delete({ where: { id } });
    return { ok: true };
  }

  async addTags(tenantId: string, contactId: string, tagIds: string[]) {
    await this.getOne(tenantId, contactId);
    const tags = await this.prisma.tag.findMany({
      where: { tenantId, id: { in: tagIds } },
    });
    return this.prisma.contact.update({
      where: { id: contactId },
      data: { tags: { connect: tags.map((t) => ({ id: t.id })) } },
      include: { tags: true },
    });
  }

  async removeTags(tenantId: string, contactId: string, tagIds: string[]) {
    await this.getOne(tenantId, contactId);
    return this.prisma.contact.update({
      where: { id: contactId },
      data: { tags: { disconnect: tagIds.map((id) => ({ id })) } },
      include: { tags: true },
    });
  }
}
