import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  list(
    tenantId: string,
    filters: { status?: string; assignedTo?: string; search?: string; channel?: string },
  ) {
    return this.prisma.conversation.findMany({
      where: {
        tenantId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
        ...(filters.channel ? { channel: filters.channel as "WHATSAPP" | "INSTAGRAM" } : {}),
        ...(filters.search
          ? {
              contact: {
                OR: [
                  { name: { contains: filters.search, mode: "insensitive" } },
                  { phone: { contains: filters.search } },
                  { username: { contains: filters.search, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      include: {
        contact: true,
        assignee: { select: { id: true, name: true, email: true } },
        instance: { select: { id: true, name: true, status: true } },
        instagramAccount: { select: { id: true, name: true, igUsername: true, status: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
    });
  }

  async getOne(tenantId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        contact: { include: { tags: true } },
        assignee: { select: { id: true, name: true, email: true } },
        instance: true,
        instagramAccount: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!conversation) {
      throw new NotFoundException("Conversa não encontrada");
    }
    return conversation;
  }

  async assign(tenantId: string, id: string, assignedTo: string | null) {
    await this.ensureExists(tenantId, id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { assignedTo },
      include: { assignee: { select: { id: true, name: true } } },
    });
    this.emitUpdated(tenantId, updated);
    return updated;
  }

  async transfer(tenantId: string, id: string, assignedTo: string) {
    return this.assign(tenantId, id, assignedTo);
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    await this.ensureExists(tenantId, id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { status },
    });
    this.emitUpdated(tenantId, updated);
    return updated;
  }

  async setPendingUnassigned(tenantId: string, id: string) {
    const updated = await this.prisma.conversation.update({
      where: { id, tenantId },
      data: { status: "pending", assignedTo: null },
    });
    this.emitUpdated(tenantId, updated);
    return updated;
  }

  async addInternalNote(tenantId: string, conversationId: string, content: string) {
    await this.ensureExists(tenantId, conversationId);
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: "outbound",
        type: "text",
        content,
        isInternal: true,
      },
    });

    this.realtime.emitToTenant(tenantId, "message:new", {
      conversationId,
      message: {
        id: message.id,
        direction: message.direction,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        isInternal: true,
      },
    });

    return message;
  }

  private async ensureExists(tenantId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId } });
    if (!conversation) {
      throw new NotFoundException("Conversa não encontrada");
    }
    return conversation;
  }

  private emitUpdated(tenantId: string, conversation: { id: string; status: string; assignedTo: string | null }) {
    this.realtime.emitToTenant(tenantId, "conversation:updated", {
      id: conversation.id,
      status: conversation.status,
      assignedTo: conversation.assignedTo,
    });
  }
}
