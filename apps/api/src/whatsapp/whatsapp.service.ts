import { Inject, Injectable, NotFoundException, BadRequestException, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { EvolutionClient } from "./evolution.client";
import { FlowExecutorService } from "../flows/flow-executor.service";

export interface InboundMessageInput {
  tenantId: string;
  instanceId: string;
  phone: string;
  name?: string;
  text: string;
  externalId?: string;
}

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
    @Inject(forwardRef(() => FlowExecutorService))
    private readonly flowExecutor: FlowExecutorService,
  ) {}

  listInstances(tenantId: string) {
    return this.prisma.whatsappInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createInstance(tenantId: string, name: string) {
    const count = await this.prisma.whatsappInstance.count({ where: { tenantId } });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant && count >= tenant.maxInstances) {
      throw new BadRequestException("Limite de instâncias WhatsApp atingido para o plano atual");
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const evolutionInstanceId = `${tenantId.slice(0, 8)}-${slug}-${Date.now()}`;

    await this.evolution.createInstance(evolutionInstanceId);

    const apiPrefix = this.config.get<string>("API_PREFIX", "api");
    const port = this.config.get<number>("API_PORT", 3000);
    const webhookUrl = `http://localhost:${port}/${apiPrefix}/whatsapp/webhook`;
    await this.evolution.setWebhook(evolutionInstanceId, webhookUrl);

    return this.prisma.whatsappInstance.create({
      data: {
        tenantId,
        name,
        evolutionInstanceId,
        status: "connecting",
      },
    });
  }

  async getInstance(tenantId: string, id: string) {
    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { id, tenantId },
    });
    if (!instance) {
      throw new NotFoundException("Instância WhatsApp não encontrada");
    }
    return instance;
  }

  async getQrCode(tenantId: string, id: string) {
    const instance = await this.getInstance(tenantId, id);
    if (instance.evolutionInstanceId.startsWith("demo-")) {
      return { base64: null, message: "Instância demo já está conectada" };
    }
    return this.evolution.getQrCode(instance.evolutionInstanceId);
  }

  async refreshStatus(tenantId: string, id: string) {
    const instance = await this.getInstance(tenantId, id);
    if (instance.evolutionInstanceId.startsWith("demo-")) {
      return instance;
    }

    const state = await this.evolution.getConnectionState(instance.evolutionInstanceId);
    const rawState = state.instance?.state ?? state.state ?? "disconnected";
    const status = rawState === "open" ? "connected" : rawState === "connecting" ? "connecting" : "disconnected";

    const updated = await this.prisma.whatsappInstance.update({
      where: { id: instance.id },
      data: { status },
    });

    this.realtime.emitToTenant(tenantId, "instance:status", {
      instanceId: updated.id,
      status: updated.status,
    });

    return updated;
  }

  async disconnect(tenantId: string, id: string) {
    const instance = await this.getInstance(tenantId, id);
    if (!instance.evolutionInstanceId.startsWith("demo-")) {
      await this.evolution.deleteInstance(instance.evolutionInstanceId);
    }
    await this.prisma.whatsappInstance.delete({ where: { id: instance.id } });
    return { ok: true };
  }

  async processWebhook(body: Record<string, unknown>) {
    const event = body.event as string | undefined;
    if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") {
      return { ok: true, skipped: true };
    }

    const data = body.data as Record<string, unknown> | undefined;
    const key = data?.key as { remoteJid?: string; id?: string; fromMe?: boolean } | undefined;
    if (!key || key.fromMe) {
      return { ok: true, skipped: true };
    }

    const instanceName = (body.instance as string) ?? (data?.instance as string);
    if (!instanceName) {
      return { ok: true, skipped: true };
    }

    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { evolutionInstanceId: instanceName },
    });
    if (!instance) {
      return { ok: true, skipped: true };
    }

    const message = data?.message as Record<string, unknown> | undefined;
    const text =
      (message?.conversation as string) ??
      ((message?.extendedTextMessage as { text?: string })?.text) ??
      "";

    const phone = (key.remoteJid ?? "").replace("@s.whatsapp.net", "").replace(/\D/g, "");
    const pushName = (data?.pushName as string) ?? undefined;

    return this.handleInbound({
      tenantId: instance.tenantId,
      instanceId: instance.id,
      phone,
      name: pushName,
      text,
      externalId: key.id,
    });
  }

  async handleInbound(input: InboundMessageInput) {
    const phone = input.phone.replace(/\D/g, "");
    if (!phone) {
      throw new BadRequestException("Telefone inválido");
    }

    const contact = await this.prisma.contact.upsert({
      where: { tenantId_phone: { tenantId: input.tenantId, phone } },
      create: { tenantId: input.tenantId, phone, name: input.name },
      update: input.name ? { name: input.name } : {},
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        tenantId: input.tenantId,
        contactId: contact.id,
        status: { in: ["open", "pending"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId: input.tenantId,
          contactId: contact.id,
          instanceId: input.instanceId,
          status: "open",
        },
      });
    }

    const message = await this.prisma.message.create({
      data: {
        tenantId: input.tenantId,
        conversationId: conversation.id,
        direction: "inbound",
        type: "text",
        content: input.text,
        externalId: input.externalId,
      },
    });

    const now = new Date();
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, instanceId: input.instanceId },
    });

    this.realtime.emitToTenant(input.tenantId, "message:new", {
      conversationId: conversation.id,
      message: {
        id: message.id,
        direction: message.direction,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        isInternal: message.isInternal,
      },
    });

    this.realtime.emitToTenant(input.tenantId, "conversation:updated", {
      id: conversation.id,
      lastMessageAt: now.toISOString(),
    });

    await this.flowExecutor.processInbound({
      tenantId: input.tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      instanceId: input.instanceId,
      text: input.text,
    });

    return { contact, conversation, message };
  }

  async demoInbound(
    tenantId: string,
    input: { phone: string; name?: string; text: string; instanceId?: string },
  ) {
    let instanceId = input.instanceId;
    if (!instanceId) {
      const demo = await this.prisma.whatsappInstance.findFirst({
        where: { tenantId, evolutionInstanceId: { startsWith: "demo-" } },
      });
      if (!demo) {
        throw new NotFoundException("Nenhuma instância demo encontrada");
      }
      instanceId = demo.id;
    } else {
      await this.getInstance(tenantId, instanceId);
    }

    return this.handleInbound({
      tenantId,
      instanceId,
      phone: input.phone,
      name: input.name,
      text: input.text,
      externalId: `demo-${Date.now()}`,
    });
  }

  isDemoInstance(evolutionInstanceId: string): boolean {
    return evolutionInstanceId.startsWith("demo-");
  }
}
