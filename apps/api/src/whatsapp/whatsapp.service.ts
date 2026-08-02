import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Logger,
} from "@nestjs/common";
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
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
    @Inject(forwardRef(() => FlowExecutorService))
    private readonly flowExecutor: FlowExecutorService,
  ) {}

  private toInstanceResponse<T extends { phoneNumber?: string | null }>(instance: T) {
    return {
      ...instance,
      phone: instance.phoneNumber ?? null,
    };
  }

  private resolveWebhookUrl(): string {
    const configured = this.config.get<string>("EVOLUTION_WEBHOOK_URL");
    if (configured?.trim()) {
      return configured.trim();
    }
    const apiPrefix = this.config.get<string>("API_PREFIX", "api");
    const port = this.config.get<number>("API_PORT", 3000);
    // Evolution runs in Docker; host.docker.internal reaches the API on the host (Windows/Mac).
    return `http://host.docker.internal:${port}/${apiPrefix}/whatsapp/webhook`;
  }

  async listInstances(tenantId: string) {
    const instances = await this.prisma.whatsappInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return instances.map((i) => this.toInstanceResponse(i));
  }

  async createInstance(tenantId: string, name: string) {
    const count = await this.prisma.whatsappInstance.count({ where: { tenantId } });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant && count >= tenant.maxInstances) {
      throw new BadRequestException("Limite de instâncias WhatsApp atingido para o plano atual");
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wa";
    const evolutionInstanceId = `${tenantId.slice(0, 8)}-${slug}-${Date.now()}`;

    const created = await this.evolution.createInstance(evolutionInstanceId);

    const webhookUrl = this.resolveWebhookUrl();
    try {
      await this.evolution.setWebhook(created.instanceName, webhookUrl);
    } catch (error) {
      this.logger.warn(
        `Webhook não configurado para ${created.instanceName} (${webhookUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const instance = await this.prisma.whatsappInstance.create({
      data: {
        tenantId,
        name,
        evolutionInstanceId: created.instanceName,
        status: "connecting",
      },
    });

    return {
      ...this.toInstanceResponse(instance),
      qr: created.qr ?? null,
    };
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
      return {
        base64: null,
        code: null,
        pairingCode: null,
        message:
          "Esta é a instância demo (já conectada). Crie uma nova instância WhatsApp para gerar um QR Code real.",
      };
    }

    const qr = await this.evolution.getQrCode(instance.evolutionInstanceId);
    if (!qr.base64 && !qr.code && !qr.pairingCode) {
      const state = await this.evolution.getConnectionState(instance.evolutionInstanceId).catch(() => null);
      const rawState = state?.instance?.state ?? state?.state;
      if (rawState === "open") {
        await this.prisma.whatsappInstance.update({
          where: { id: instance.id },
          data: { status: "connected" },
        });
        return {
          base64: null,
          code: null,
          pairingCode: null,
          message: "WhatsApp já está conectado. Não é necessário escanear o QR Code.",
        };
      }
      return {
        base64: null,
        code: null,
        pairingCode: null,
        message:
          "QR Code ainda não disponível. Aguarde alguns segundos e clique em Atualizar QR, ou crie uma nova instância.",
      };
    }

    await this.prisma.whatsappInstance.update({
      where: { id: instance.id },
      data: { status: "connecting" },
    });

    return {
      base64: qr.base64 ?? null,
      code: qr.code ?? null,
      pairingCode: qr.pairingCode ?? null,
      message: qr.message,
    };
  }

  async refreshStatus(tenantId: string, id: string) {
    const instance = await this.getInstance(tenantId, id);
    if (instance.evolutionInstanceId.startsWith("demo-")) {
      return this.toInstanceResponse(instance);
    }

    const state = await this.evolution.getConnectionState(instance.evolutionInstanceId);
    const rawState = state.instance?.state ?? state.state ?? "disconnected";
    const status =
      rawState === "open" ? "connected" : rawState === "connecting" ? "connecting" : "disconnected";

    const updated = await this.prisma.whatsappInstance.update({
      where: { id: instance.id },
      data: { status },
    });

    this.realtime.emitToTenant(tenantId, "instance:status", {
      instanceId: updated.id,
      status: updated.status,
    });

    return this.toInstanceResponse(updated);
  }

  async disconnect(tenantId: string, id: string) {
    const instance = await this.getInstance(tenantId, id);
    if (!instance.evolutionInstanceId.startsWith("demo-")) {
      try {
        await this.evolution.deleteInstance(instance.evolutionInstanceId);
      } catch (error) {
        this.logger.warn(
          `Falha ao remover instância Evolution ${instance.evolutionInstanceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    await this.prisma.whatsappInstance.delete({ where: { id: instance.id } });
    return { ok: true };
  }

  async processWebhook(body: Record<string, unknown>) {
    const event = body.event as string | undefined;
    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const instanceName = (body.instance as string) ?? "";
      const data = body.data as Record<string, unknown> | undefined;
      const state = (data?.state as string) ?? (data?.status as string);
      if (instanceName && state) {
        const instance = await this.prisma.whatsappInstance.findFirst({
          where: { evolutionInstanceId: instanceName },
        });
        if (instance) {
          const status =
            state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected";
          await this.prisma.whatsappInstance.update({
            where: { id: instance.id },
            data: { status },
          });
          this.realtime.emitToTenant(instance.tenantId, "instance:status", {
            instanceId: instance.id,
            status,
          });
        }
      }
      return { ok: true };
    }

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
      (message?.extendedTextMessage as { text?: string })?.text ??
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

    const result = await this.handleInbound({
      tenantId,
      instanceId,
      phone: input.phone,
      name: input.name,
      text: input.text,
      externalId: `demo-${Date.now()}`,
    });

    return {
      ...result,
      conversationId: result.conversation.id,
      contactId: result.contact.id,
      messageId: result.message.id,
    };
  }

  isDemoInstance(evolutionInstanceId: string): boolean {
    return evolutionInstanceId.startsWith("demo-");
  }
}
