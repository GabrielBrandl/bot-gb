import { Injectable, NotFoundException } from "@nestjs/common";
import { Channel } from "@bot-wpp/database";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { EvolutionClient } from "../whatsapp/evolution.client";

export type MessageAgent = { id: string; name: string };

/** Nome padrão se o tenant ainda não tiver agente de IA. */
export const BOT_DISPLAY_NAME = "Assistente virtual";

/** Prefixa o nome do atendente para o cliente ver no WhatsApp/Instagram. */
export function withAgentSignature(agentName: string, content: string): string {
  const name = agentName.trim();
  if (!name) return content;
  return `*${name}:*\n${content}`;
}

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
      include: {
        sentBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  private async resolveBotDisplayName(tenantId: string): Promise<string> {
    const bot = await this.prisma.aIAgent.findFirst({
      where: { tenantId, active: true },
      orderBy: { createdAt: "asc" },
      select: { name: true },
    });
    return bot?.name?.trim() || BOT_DISPLAY_NAME;
  }

  async sendText(
    tenantId: string,
    conversationId: string,
    content: string,
    mediaUrl?: string,
    agent?: MessageAgent | null,
  ) {
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
    // Humano: nome do atendente. Bot/IA: nome do agente ativo do tenant.
    const signatureName = agent?.name?.trim() || (await this.resolveBotDisplayName(tenantId));
    const outboundContent = withAgentSignature(signatureName, content);

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
          await this.evolution.sendMedia(instance.evolutionInstanceId, phone, mediaUrl, outboundContent);
        } else {
          await this.evolution.sendText(instance.evolutionInstanceId, phone, outboundContent);
        }
      }
    }

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: "outbound",
        type: mediaUrl ? "media" : "text",
        // Guarda o texto digitado; o prefixo com nome vai só no WhatsApp do cliente.
        content,
        mediaUrl,
        channel,
        sentByUserId: agent?.id ?? null,
      },
      include: {
        sentBy: { select: { id: true, name: true } },
      },
    });

    const now = new Date();
    const conversationUpdate: {
      lastMessageAt: Date;
      assignedTo?: string;
      status?: string;
    } = { lastMessageAt: now };

    if (agent?.id) {
      conversationUpdate.assignedTo = agent.id;
      if (conversation.status === "pending") {
        conversationUpdate.status = "open";
      }
    }

    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: conversationUpdate,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    this.realtime.emitToTenant(tenantId, "message:new", {
      conversationId,
      message: {
        id: message.id,
        direction: message.direction,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        channel,
        sentBy: message.sentBy,
      },
    });

    this.realtime.emitToTenant(tenantId, "conversation:updated", {
      id: conversationId,
      lastMessageAt: now.toISOString(),
      channel,
      assignedTo: updatedConversation.assignedTo,
      assignee: updatedConversation.assignee,
      status: updatedConversation.status,
    });

    return message;
  }
}
