import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  forwardRef,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { EvolutionClient, type EvolutionQrResponse } from "./evolution.client";
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

  /** Normaliza para dígitos E.164 sem +. Não inventa o 9 — usa o número informado. */
  private normalizeWhatsappNumber(phoneNumber?: string | null): string | undefined {
    if (!phoneNumber) return undefined;
    let digits = phoneNumber.replace(/\D/g, "");
    if (!digits) return undefined;
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);

    // Já com DDI (ex: 559233051829) — respeita exatamente o que veio
    if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 15) {
      return digits;
    }

    // Nacional com DDD: 10 ou 11 dígitos → só prefixa 55
    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }

    if (digits.length >= 12 && digits.length <= 15) return digits;
    return undefined;
  }

  private resolveWebhookUrl(): string {
    const configured = this.config.get<string>("EVOLUTION_WEBHOOK_URL");
    if (configured?.trim()) {
      return configured.trim();
    }
    const apiPrefix = this.config.get<string>("API_PREFIX", "api");
    // Produção (EasyPanel): PUBLIC_API_URL=https://api.seudominio.com
    const publicApi = this.config.get<string>("PUBLIC_API_URL")?.trim().replace(/\/$/, "");
    if (publicApi) {
      return `${publicApi}/${apiPrefix}/whatsapp/webhook`;
    }
    const port = this.config.get<number>("API_PORT", 3000);
    // Local: Evolution no Docker → API no host (Windows/Mac).
    return `http://host.docker.internal:${port}/${apiPrefix}/whatsapp/webhook`;
  }

  async listInstances(tenantId: string) {
    const instances = await this.prisma.whatsappInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    // Reconcilia status com a Evolution (evita ficar preso em "conectando").
    const synced = await Promise.all(
      instances.map(async (instance) => {
        if (
          instance.evolutionInstanceId === "demo" ||
          instance.evolutionInstanceId.startsWith("demo-")
        ) {
          return instance;
        }
        try {
          const state = await this.evolution.getConnectionState(instance.evolutionInstanceId);
          const rawState = state.instance?.state ?? state.state;
          if (!rawState) return instance;
          const status = this.evolution.mapConnectionStatus(rawState);
          if (status === instance.status) return instance;
          const updated = await this.prisma.whatsappInstance.update({
            where: { id: instance.id },
            data: { status },
          });
          this.realtime.emitToTenant(tenantId, "instance:status", {
            instanceId: updated.id,
            status: updated.status,
          });
          return updated;
        } catch {
          return instance;
        }
      }),
    );

    return synced.map((i) => this.toInstanceResponse(i));
  }

  async createInstance(tenantId: string, name: string, phoneNumber?: string) {
    const count = await this.prisma.whatsappInstance.count({ where: { tenantId } });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant && count >= tenant.maxInstances) {
      throw new BadRequestException("Limite de instâncias WhatsApp atingido para o plano atual");
    }

    const digits = this.normalizeWhatsappNumber(phoneNumber);
    if (phoneNumber && !digits) {
      throw new BadRequestException("Informe o número do WhatsApp com DDD (ex: 92999999999)");
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wa";
    const evolutionInstanceId = `${tenantId.slice(0, 8)}-${slug}-${Date.now()}`;

    const evolutionUp = await this.evolution.isAvailable();
    if (!evolutionUp) {
      const instance = await this.prisma.whatsappInstance.create({
        data: {
          tenantId,
          name,
          evolutionInstanceId,
          phoneNumber: digits || null,
          status: "disconnected",
        },
      });
      return {
        ...this.toInstanceResponse(instance),
        qr: null,
        evolutionOnline: false,
        message:
          "Instância salva, mas a Evolution API está offline. Inicie o Docker Desktop e rode: docker compose -f docker/docker-compose.evolution.yml up -d — depois clique em Conectar / QR.",
      };
    }

    let created: { instanceName: string; qr?: EvolutionQrResponse | null };
    try {
      created = await this.evolution.createInstance(evolutionInstanceId, digits);
    } catch (error) {
      const instance = await this.prisma.whatsappInstance.create({
        data: {
          tenantId,
          name,
          evolutionInstanceId,
          phoneNumber: digits || null,
          status: "disconnected",
        },
      });
      return {
        ...this.toInstanceResponse(instance),
        qr: null,
        evolutionOnline: false,
        message:
          error instanceof Error
            ? `${error.message} Instância salva localmente — suba a Evolution e use Conectar.`
            : "Evolution indisponível. Instância salva localmente.",
      };
    }

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
        phoneNumber: digits || null,
        status: "connecting",
      },
    });

    return {
      ...this.toInstanceResponse(instance),
      qr: created.qr ?? null,
      evolutionOnline: true,
    };
  }

  /** Provisiona na Evolution uma instância que foi criada offline. */
  async provisionInstance(tenantId: string, id: string) {
    const instance = await this.getInstance(tenantId, id);
    if (instance.evolutionInstanceId.startsWith("demo-") || instance.evolutionInstanceId === "demo") {
      throw new BadRequestException("Instância demo não precisa de provisionamento");
    }

    const evolutionUp = await this.evolution.isAvailable();
    if (!evolutionUp) {
      throw new ServiceUnavailableException(
        "Evolution API offline. Inicie o Docker Desktop e: docker compose -f docker/docker-compose.evolution.yml up -d",
      );
    }

    const created = await this.evolution.createInstance(
      instance.evolutionInstanceId,
      instance.phoneNumber ?? undefined,
    );

    const webhookUrl = this.resolveWebhookUrl();
    try {
      await this.evolution.setWebhook(created.instanceName, webhookUrl);
    } catch (error) {
      this.logger.warn(
        `Webhook não configurado para ${created.instanceName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const updated = await this.prisma.whatsappInstance.update({
      where: { id: instance.id },
      data: {
        evolutionInstanceId: created.instanceName,
        status: "connecting",
      },
    });

    return {
      ...this.toInstanceResponse(updated),
      qr: created.qr ?? null,
      evolutionOnline: true,
    };
  }

  async evolutionStatus() {
    const online = await this.evolution.isAvailable();
    return {
      online,
      url: this.config.get<string>("EVOLUTION_API_URL", "http://localhost:8080"),
      hint: online
        ? "Evolution API online"
        : "Evolution offline. Abra o Docker Desktop e rode: docker compose -f docker/docker-compose.evolution.yml up -d",
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

  async getQrCode(tenantId: string, id: string, phoneNumber?: string) {
    const instance = await this.getInstance(tenantId, id);
    if (instance.evolutionInstanceId === "demo" || instance.evolutionInstanceId.startsWith("demo-")) {
      return {
        base64: null,
        code: null,
        pairingCode: null,
        message:
          "Esta é a instância demo (já conectada). Crie uma nova instância WhatsApp para gerar um QR Code real.",
      };
    }

    const digits = this.normalizeWhatsappNumber(phoneNumber) || this.normalizeWhatsappNumber(instance.phoneNumber);
    if (phoneNumber && !digits) {
      throw new BadRequestException("Informe o número do WhatsApp com DDD (ex: 92999999999)");
    }

    const qr = await this.evolution.getQrCode(instance.evolutionInstanceId, digits);
    if (!qr.base64 && !qr.code && !qr.pairingCode) {
      const state = await this.evolution.getConnectionState(instance.evolutionInstanceId).catch(() => null);
      const rawState = state?.instance?.state ?? state?.state;
      const mapped = this.evolution.mapConnectionStatus(rawState);
      if (mapped === "connected") {
        const updated = await this.prisma.whatsappInstance.update({
          where: { id: instance.id },
          data: { status: "connected", ...(digits ? { phoneNumber: digits } : {}) },
        });
        this.realtime.emitToTenant(tenantId, "instance:status", {
          instanceId: updated.id,
          status: updated.status,
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
        message: digits
          ? "Código de pareamento ainda não disponível. Aguarde alguns segundos e tente novamente."
          : "QR Code ainda não disponível. Aguarde alguns segundos e clique em Atualizar QR, ou crie uma nova instância.",
      };
    }

    await this.prisma.whatsappInstance.update({
      where: { id: instance.id },
      data: {
        status: "connecting",
        ...(digits ? { phoneNumber: digits } : {}),
      },
    });

    const webhookUrl = this.resolveWebhookUrl();
    try {
      await this.evolution.setWebhook(instance.evolutionInstanceId, webhookUrl);
    } catch (error) {
      this.logger.warn(
        `Webhook não reconfigurado para ${instance.evolutionInstanceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      base64: digits ? null : qr.base64 ?? null,
      code: digits ? null : qr.code ?? null,
      pairingCode: qr.pairingCode ?? null,
      message: qr.message,
    };
  }

  /** Gera código de pareamento válido: reseta sessão se necessário e força connect com número. */
  async getPairingCode(tenantId: string, id: string, phoneNumber?: string) {
    const instance = await this.getInstance(tenantId, id);
    if (instance.evolutionInstanceId === "demo" || instance.evolutionInstanceId.startsWith("demo-")) {
      return {
        base64: null,
        code: null,
        pairingCode: null,
        message: "Instância demo não usa código de pareamento.",
      };
    }

    const digits =
      this.normalizeWhatsappNumber(phoneNumber) || this.normalizeWhatsappNumber(instance.phoneNumber);
    if (!digits) {
      throw new BadRequestException(
        "Informe o número do WhatsApp com DDD (ex: 92999999999). O 9 do celular e o +55 são ajustados automaticamente.",
      );
    }

    await this.prisma.whatsappInstance.update({
      where: { id: instance.id },
      data: { phoneNumber: digits, status: "connecting" },
    });

    try {
      const state = await this.evolution.getConnectionState(instance.evolutionInstanceId).catch(() => null);
      const raw = (state?.instance?.state ?? state?.state ?? "").toLowerCase();
      // Se já está em QR/connecting, o Evolution reusa sessão antiga e o código fica inválido.
      if (raw === "connecting" || raw === "open") {
        await this.evolution.logout(instance.evolutionInstanceId);
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (error) {
      this.logger.warn(
        `Logout pré-pareamento falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const qr = await this.evolution.getPairingCode(instance.evolutionInstanceId, digits);

    const webhookUrl = this.resolveWebhookUrl();
    try {
      await this.evolution.setWebhook(instance.evolutionInstanceId, webhookUrl);
    } catch (error) {
      this.logger.warn(
        `Webhook não reconfigurado no pareamento: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!qr.pairingCode) {
      return {
        base64: null,
        code: null,
        pairingCode: null,
        phone: digits,
        message:
          "Código ainda não gerado. Confira o número (DDD + celular com 9) e clique em Gerar código de novo em até 1 minuto.",
      };
    }

    return {
      base64: null,
      code: null,
      pairingCode: qr.pairingCode,
      phone: digits,
      message: `Digite o código no celular em até 1 minuto. Número usado: +${digits}`,
    };
  }

  async refreshStatus(tenantId: string, id: string) {
    const instance = await this.getInstance(tenantId, id);
    if (instance.evolutionInstanceId === "demo" || instance.evolutionInstanceId.startsWith("demo-")) {
      return this.toInstanceResponse(instance);
    }

    const state = await this.evolution.getConnectionState(instance.evolutionInstanceId);
    const rawState = state.instance?.state ?? state.state ?? "close";
    const status = this.evolution.mapConnectionStatus(rawState);

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
    if (instance.evolutionInstanceId !== "demo" && !instance.evolutionInstanceId.startsWith("demo-")) {
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
      const data = body.data as Record<string, unknown> | undefined;
      const nestedInstance = data?.instance;
      const instanceName =
        (typeof body.instance === "string" && body.instance) ||
        (typeof body.instanceName === "string" && body.instanceName) ||
        (typeof nestedInstance === "string" && nestedInstance) ||
        (nestedInstance &&
          typeof nestedInstance === "object" &&
          typeof (nestedInstance as { instanceName?: string }).instanceName === "string" &&
          (nestedInstance as { instanceName: string }).instanceName) ||
        "";
      const nestedState =
        nestedInstance && typeof nestedInstance === "object"
          ? (nestedInstance as { state?: string; status?: string }).state ||
            (nestedInstance as { state?: string; status?: string }).status
          : undefined;
      const state =
        (typeof data?.state === "string" && data.state) ||
        (typeof data?.status === "string" && data.status) ||
        (typeof nestedState === "string" && nestedState) ||
        "";
      if (instanceName && state) {
        const instance = await this.prisma.whatsappInstance.findFirst({
          where: { evolutionInstanceId: instanceName },
        });
        if (instance) {
          const status = this.evolution.mapConnectionStatus(state);
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
        where: {
          tenantId,
          OR: [
            { evolutionInstanceId: { startsWith: "demo-" } },
            { evolutionInstanceId: "demo" },
          ],
        },
        orderBy: { createdAt: "desc" },
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
    return evolutionInstanceId === "demo" || evolutionInstanceId.startsWith("demo-");
  }
}
