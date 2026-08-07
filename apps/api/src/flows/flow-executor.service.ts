import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MessagesService } from "../messages/messages.service";
import { ConversationsService } from "../conversations/conversations.service";
import { AiService } from "../ai/ai.service";
import { PaymentsService } from "../payments/payments.service";
import {
  evaluateCondition,
  findMatchingFlow,
  getNextNode,
  getStartNode,
  isWithinBusinessHours,
  parseFlowGraph,
  type BusinessSchedule,
} from "./flow-utils";
import type { FlowNode } from "@bot-wpp/shared-types";

export interface InboundFlowContext {
  tenantId: string;
  conversationId: string;
  contactId: string;
  instanceId: string;
  text: string;
}

@Injectable()
export class FlowExecutorService {
  private readonly logger = new Logger(FlowExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly conversations: ConversationsService,
    private readonly ai: AiService,
    private readonly payments: PaymentsService,
  ) {}

  async processInbound(ctx: InboundFlowContext): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: ctx.conversationId, tenantId: ctx.tenantId },
    });

    // Se um atendente humano já assumiu, não interferir com a automação.
    if (conversation?.assignedTo) {
      return;
    }

    const flows = await this.prisma.flow.findMany({
      where: { tenantId: ctx.tenantId, active: true },
    });

    const matched = findMatchingFlow(flows, ctx.text);
    const hours = await this.prisma.businessHours.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    const open = isWithinBusinessHours(
      (hours?.schedule as BusinessSchedule | null) ?? null,
      hours?.timezone ?? "America/Manaus",
    );

    // Fora do horário: responde com a mensagem de ausência (qualquer mensagem).
    if (!open) {
      const away =
        hours?.awayMessage?.trim() ||
        "No momento estamos fora do horário de atendimento. Retornaremos assim que possível.";
      await this.messages.sendText(ctx.tenantId, ctx.conversationId, away);
      await this.conversations.setPendingUnassigned(ctx.tenantId, ctx.conversationId);
      return;
    }

    if (!matched) {
      // Sem fluxo de palavra-chave: Bot Ti (agente IA ativo) responde.
      const agent = await this.prisma.aIAgent.findFirst({
        where: { tenantId: ctx.tenantId, active: true },
        orderBy: { createdAt: "asc" },
      });
      if (agent) {
        const reply = await this.ai.askAgent(ctx.tenantId, agent.id, {
          question: ctx.text,
          conversationId: ctx.conversationId,
        });
        if (reply.answer?.trim()) {
          await this.messages.sendText(ctx.tenantId, ctx.conversationId, reply.answer.trim());
        }
      }
      return;
    }

    const graph = parseFlowGraph(matched.nodes);
    let current = getStartNode(graph);
    if (!current) {
      return;
    }

    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const next = await this.executeNode(ctx, current, graph);
      current = next;
    }
  }

  private async executeNode(
    ctx: InboundFlowContext,
    node: FlowNode,
    graph: ReturnType<typeof parseFlowGraph>,
  ): Promise<FlowNode | undefined> {
    const data = node.data ?? {};

    switch (node.type) {
      case "trigger":
      case "keyword":
        return getNextNode(graph, node.id);

      case "message":
      case "send_text": {
        const text = String(data.text ?? data.message ?? "");
        if (text) {
          await this.messages.sendText(ctx.tenantId, ctx.conversationId, text);
        }
        return getNextNode(graph, node.id);
      }

      case "condition": {
        const result = evaluateCondition(data, ctx.text);
        return getNextNode(graph, node.id, result ? "true" : "false");
      }

      case "collect_variable": {
        const field = String(data.field ?? data.variable ?? "collected");
        const contact = await this.prisma.contact.findFirst({
          where: { id: ctx.contactId, tenantId: ctx.tenantId },
        });
        const existing = (contact?.customFields as Record<string, unknown>) ?? {};
        await this.prisma.contact.update({
          where: { id: ctx.contactId },
          data: {
            customFields: { ...existing, [field]: ctx.text } as object,
          },
        });
        return getNextNode(graph, node.id);
      }

      case "transfer_human":
        await this.conversations.setPendingUnassigned(ctx.tenantId, ctx.conversationId);
        return undefined;

      case "ai_reply": {
        const agentId = String(data.agentId ?? "");
        if (agentId) {
          const reply = await this.ai.askAgent(ctx.tenantId, agentId, {
            question: ctx.text,
            conversationId: ctx.conversationId,
          });
          if (reply.answer) {
            await this.messages.sendText(ctx.tenantId, ctx.conversationId, reply.answer);
          }
        }
        return getNextNode(graph, node.id);
      }

      case "payment_link": {
        const amount = Number(data.amount ?? 0);
        if (amount > 0) {
          const billingType = String(data.billingType ?? "UNDEFINED") as
            | "PIX"
            | "BOLETO"
            | "CREDIT_CARD"
            | "UNDEFINED";
          const payment = await this.payments.create(ctx.tenantId, {
            contactId: ctx.contactId,
            amount,
            billingType,
            description: String(data.description ?? "Pagamento via automação"),
            sendViaWhatsApp: true,
            conversationId: ctx.conversationId,
          });
          if (!payment.link) {
            await this.messages.sendText(
              ctx.tenantId,
              ctx.conversationId,
              "Não foi possível gerar o link de pagamento agora. Um atendente vai te ajudar.",
            );
          }
        }
        return getNextNode(graph, node.id);
      }

      default:
        this.logger.debug(`Unknown flow node type: ${node.type}`);
        return getNextNode(graph, node.id);
    }
  }
}
