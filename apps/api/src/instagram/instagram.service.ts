import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Channel } from "@bot-wpp/database";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { FlowExecutorService } from "../flows/flow-executor.service";

@Injectable()
export class InstagramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
    private readonly flowExecutor: FlowExecutorService,
  ) {}

  list(tenantId: string) {
    return this.prisma.instagramAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(tenantId: string, name: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { planRef: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado");

    if (!tenant.planRef?.instagramEnabled && tenant.maxInstagram <= 0) {
      throw new ForbiddenException("Seu plano não inclui Instagram. Faça upgrade para Professional ou Enterprise.");
    }

    const count = await this.prisma.instagramAccount.count({ where: { tenantId } });
    if (count >= tenant.maxInstagram) {
      throw new ForbiddenException(`Limite de contas Instagram atingido (${tenant.maxInstagram}).`);
    }

    const igUserId = `ig_${Date.now()}`;
    const account = await this.prisma.instagramAccount.create({
      data: {
        tenantId,
        name,
        igUserId,
        igUsername: name.toLowerCase().replace(/\s+/g, "."),
        status: "connecting",
      },
    });

    return {
      ...account,
      connectUrl: this.buildMetaConnectHint(),
      note: "Configure META_APP_ID / META_APP_SECRET no .env para OAuth real. Em demo, use 'Simular DM Instagram'.",
    };
  }

  async markConnected(tenantId: string, accountId: string) {
    const account = await this.requireAccount(tenantId, accountId);
    return this.prisma.instagramAccount.update({
      where: { id: account.id },
      data: { status: "connected" },
    });
  }

  async remove(tenantId: string, accountId: string) {
    const account = await this.requireAccount(tenantId, accountId);
    await this.prisma.instagramAccount.delete({ where: { id: account.id } });
    return { ok: true };
  }

  async handleWebhook(body: Record<string, unknown>) {
    const entry = Array.isArray(body.entry) ? (body.entry[0] as Record<string, unknown>) : null;
    if (!entry) return { ok: true };

    const messaging = Array.isArray(entry.messaging)
      ? (entry.messaging[0] as Record<string, unknown>)
      : null;
    if (!messaging) return { ok: true };

    const sender = messaging.sender as { id?: string } | undefined;
    const recipient = messaging.recipient as { id?: string } | undefined;
    const message = messaging.message as { text?: string; mid?: string } | undefined;
    if (!sender?.id || !message?.text) return { ok: true };

    const account = await this.prisma.instagramAccount.findFirst({
      where: {
        OR: [{ igUserId: recipient?.id ?? "" }, { pageId: recipient?.id ?? "" }],
        status: "connected",
      },
    });
    if (!account) return { ok: true };

    await this.ingestInbound({
      tenantId: account.tenantId,
      accountId: account.id,
      igUserId: sender.id,
      text: message.text,
      externalId: message.mid,
    });

    return { ok: true };
  }

  async simulateInbound(tenantId: string, dto: { username?: string; text: string; accountId?: string }) {
    if (!dto.text?.trim()) throw new BadRequestException("Texto obrigatório");

    const account = dto.accountId
      ? await this.requireAccount(tenantId, dto.accountId)
      : await this.prisma.instagramAccount.findFirst({
          where: { tenantId, status: "connected" },
          orderBy: { createdAt: "asc" },
        });

    if (!account) throw new NotFoundException("Nenhuma conta Instagram conectada");

    const igUserId = `sim_${(dto.username || "lead").replace(/\W/g, "")}_${Date.now().toString(36)}`;
    return this.ingestInbound({
      tenantId,
      accountId: account.id,
      igUserId,
      username: dto.username || "lead.instagram",
      text: dto.text.trim(),
    });
  }

  async sendText(tenantId: string, conversationId: string, text: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, channel: Channel.INSTAGRAM },
      include: { contact: true, instagramAccount: true },
    });
    if (!conversation) throw new NotFoundException("Conversa Instagram não encontrada");

    // Meta Graph API send would go here when tokens are configured
    const token = conversation.instagramAccount?.accessTokenEnc;
    if (token && this.config.get("META_PAGE_ACCESS_TOKEN")) {
      // Placeholder for production Graph API call
    }

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: "outbound",
        type: "text",
        content: text,
        channel: Channel.INSTAGRAM,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    this.realtime.emitToTenant(tenantId, "message:new", {
      conversationId,
      message: {
        id: message.id,
        direction: message.direction,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        channel: Channel.INSTAGRAM,
      },
    });

    return message;
  }

  private async ingestInbound(input: {
    tenantId: string;
    accountId: string;
    igUserId: string;
    username?: string;
    text: string;
    externalId?: string;
  }) {
    const contact = await this.prisma.contact.upsert({
      where: {
        tenantId_instagramId: {
          tenantId: input.tenantId,
          instagramId: input.igUserId,
        },
      },
      update: {
        name: input.username || undefined,
        username: input.username || undefined,
      },
      create: {
        tenantId: input.tenantId,
        instagramId: input.igUserId,
        username: input.username,
        name: input.username || "Instagram Lead",
      },
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        tenantId: input.tenantId,
        contactId: contact.id,
        channel: Channel.INSTAGRAM,
        status: { in: ["open", "pending"] },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId: input.tenantId,
          contactId: contact.id,
          channel: Channel.INSTAGRAM,
          instagramAccountId: input.accountId,
          status: "open",
          lastMessageAt: new Date(),
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
        channel: Channel.INSTAGRAM,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: "open" },
    });

    this.realtime.emitToTenant(input.tenantId, "message:new", {
      conversationId: conversation.id,
      message: {
        id: message.id,
        direction: message.direction,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        channel: Channel.INSTAGRAM,
      },
    });

    try {
      await this.flowExecutor.processInbound({
        tenantId: input.tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        instanceId: input.accountId,
        text: input.text,
      });
    } catch {
      // flow optional
    }

    return { conversation, message, contact };
  }

  private async requireAccount(tenantId: string, accountId: string) {
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) throw new NotFoundException("Conta Instagram não encontrada");
    return account;
  }

  private buildMetaConnectHint() {
    const appId = this.config.get<string>("META_APP_ID");
    if (!appId) return null;
    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&scope=instagram_basic,instagram_manage_messages,pages_messaging`;
  }
}
