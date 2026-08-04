import { Injectable, NotFoundException } from "@nestjs/common";
import { Channel } from "@bot-wpp/database";
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
        instagramAccount: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException("Conversa não encontrada");
    }

    const channel = conversation.channel ?? Channel.WHATSAPP;

    if (channel === Channel.WHATSAPP) {
      const instance = conversation.instance;
      const phone = conversation.contact.phone;
      const isDemoOrDisconnected =
        !instance ||
        !phone ||
        instance.status === "disconnected" ||
        instance.evolutionInstanceId.startsWith("demo");

      if (!isDemoOrDisconnected && instance && phone) {
        if (mediaUrl) {
          await this.evolution.sendMedia(instance.evolutionInstanceId, phone, mediaUrl, content);
        } else {
          await this.evolution.sendText(instance.evolutionInstanceId, phone, content);
        }
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
        channel,
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
        channel,
      },
    });

    this.realtime.emitToTenant(tenantId, "conversation:updated", {
      id: conversationId,
      lastMessageAt: now.toISOString(),
      channel,
    });

    return message;
  }
}
