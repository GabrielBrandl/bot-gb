import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { EvolutionClient } from "../whatsapp/evolution.client";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly evolution: EvolutionClient,
  ) {}

  async list(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conversation) {
      throw new NotFoundException("Conversa não encontrada");
    }
    return this.prisma.message.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async sendText(tenantId: string, conversationId: string, content: string, mediaUrl?: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        contact: true,
        instance: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException("Conversa não encontrada");
    }

    const instance = conversation.instance;
    const isDemoOrDisconnected =
      !instance ||
      instance.status === "disconnected" ||
      instance.evolutionInstanceId.startsWith("demo-");

    if (!isDemoOrDisconnected && instance) {
      if (mediaUrl) {
        await this.evolution.sendMedia(instance.evolutionInstanceId, conversation.contact.phone, mediaUrl, content);
      } else {
        await this.evolution.sendText(instance.evolutionInstanceId, conversation.contact.phone, content);
      }
    }

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: "outbound",
        type: mediaUrl ? "media" : "text",
        content,
        mediaUrl,
      },
    });

    const now = new Date();
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    });

    this.realtime.emitToTenant(tenantId, "message:new", {
      conversationId,
      message: {
        id: message.id,
        direction: message.direction,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    });

    this.realtime.emitToTenant(tenantId, "conversation:updated", {
      id: conversationId,
      lastMessageAt: now.toISOString(),
    });

    return message;
  }
}
