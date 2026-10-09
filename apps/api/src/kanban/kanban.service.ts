import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@bot-wpp/database";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_STAGES = ["Novo", "Em atendimento", "Aguardando", "Resolvido"];

const cardInclude = {
  contact: { select: { id: true, name: true, phone: true, username: true } },
  conversation: {
    select: {
      id: true,
      status: true,
      channel: true,
      assignee: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.KanbanCardInclude;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Estágio do quadro → status da conversa no Inbox. */
function statusForStage(name: string): string | null {
  const n = fold(name);
  if (/resolv|fechad|conclu/.test(n)) return "closed";
  if (/aguard/.test(n)) return "pending";
  if (/\bnovo\b/.test(n)) return "pending";
  if (/atend|andamento|aberto/.test(n)) return "open";
  return null;
}

function stageIdForConversation(
  stages: Array<{ id: string; name: string }>,
  status: string,
  assignedTo: string | null,
): string {
  const match = (re: RegExp) => stages.find((s) => re.test(fold(s.name)))?.id;
  if (status === "closed") {
    return match(/resolv|fechad|conclu/) ?? stages[stages.length - 1]?.id ?? stages[0].id;
  }
  if (assignedTo) {
    return match(/atend|andamento/) ?? stages[Math.min(1, stages.length - 1)].id;
  }
  if (status === "pending") {
    return match(/aguard|\bnovo\b/) ?? stages[0].id;
  }
  return match(/\bnovo\b/) ?? stages[0].id;
}

@Injectable()
export class KanbanService {
  constructor(private readonly prisma: PrismaService) {}

  getBoards(tenantId: string) {
    return this.prisma.kanbanBoard.findMany({
      where: { tenantId },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            cards: {
              orderBy: { order: "asc" },
              include: cardInclude,
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async ensureBoard(tenantId: string) {
    const existing = await this.prisma.kanbanBoard.findFirst({ where: { tenantId } });
    if (existing) return existing;

    const board = await this.prisma.kanbanBoard.create({
      data: { tenantId, name: "Atendimentos" },
    });
    await this.prisma.kanbanStage.createMany({
      data: DEFAULT_STAGES.map((name, order) => ({
        tenantId,
        boardId: board.id,
        name,
        order,
      })),
    });
    return board;
  }

  async getBoard(tenantId: string) {
    await this.ensureBoard(tenantId);
    const boards = await this.getBoards(tenantId);
    const board = boards[0];
    if (!board) {
      throw new NotFoundException("Nenhum board Kanban encontrado");
    }
    return board;
  }

  /** Cria um card para cada conversa aberta/pendente que ainda não está no quadro. */
  async syncFromInbox(tenantId: string) {
    const board = await this.getBoard(tenantId);
    const stages = board.stages.map((s) => ({ id: s.id, name: s.name }));
    if (!stages.length) return { created: 0 };

    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId, status: { in: ["open", "pending"] } },
      include: {
        contact: { select: { id: true, name: true, phone: true, username: true } },
        kanbanCards: { select: { id: true } },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    let created = 0;
    for (const conversation of conversations) {
      if (conversation.kanbanCards.length > 0) continue;
      const stageId = stageIdForConversation(stages, conversation.status, conversation.assignedTo);
      const title =
        conversation.contact.name?.trim() ||
        conversation.contact.phone ||
        conversation.contact.username ||
        "Conversa";
      await this.createCard(tenantId, {
        stageId,
        contactId: conversation.contactId,
        conversationId: conversation.id,
        title,
      });
      created += 1;
    }

    return { created };
  }

  async createCard(
    tenantId: string,
    data: {
      stageId: string;
      contactId?: string;
      title?: string;
      conversationId?: string;
      dealValue?: number;
    },
  ) {
    const stage = await this.prisma.kanbanStage.findFirst({
      where: { id: data.stageId, tenantId },
    });
    if (!stage) {
      throw new NotFoundException("Estágio não encontrado");
    }

    let contactId = data.contactId;
    if (!contactId) {
      const contact = await this.prisma.contact.create({
        data: {
          tenantId,
          name: data.title?.trim() || "Card sem contato",
        },
      });
      contactId = contact.id;
    } else {
      const contact = await this.prisma.contact.findFirst({
        where: { id: contactId, tenantId },
      });
      if (!contact) throw new NotFoundException("Contato não encontrado");
    }

    const maxOrder = await this.prisma.kanbanCard.aggregate({
      where: { stageId: data.stageId },
      _max: { order: true },
    });

    return this.prisma.kanbanCard.create({
      data: {
        tenantId,
        stageId: data.stageId,
        contactId,
        title: data.title?.trim() || undefined,
        conversationId: data.conversationId,
        dealValue: data.dealValue !== undefined ? new Prisma.Decimal(data.dealValue) : undefined,
        order: (maxOrder._max.order ?? -1) + 1,
      },
      include: cardInclude,
    });
  }

  async moveCard(tenantId: string, cardId: string, stageId: string, order: number) {
    const card = await this.prisma.kanbanCard.findFirst({ where: { id: cardId, tenantId } });
    if (!card) {
      throw new NotFoundException("Card não encontrado");
    }

    const stage = await this.prisma.kanbanStage.findFirst({ where: { id: stageId, tenantId } });
    if (!stage) {
      throw new NotFoundException("Estágio não encontrado");
    }

    const siblings = await this.prisma.kanbanCard.findMany({
      where: { stageId, NOT: { id: cardId } },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const index = Math.min(Math.max(order, 0), siblings.length);
    const ordered = siblings.map((c) => c.id);
    ordered.splice(index, 0, cardId);

    await this.prisma.$transaction(
      ordered.map((id, position) =>
        this.prisma.kanbanCard.update({
          where: { id },
          data: { stageId, order: position },
        }),
      ),
    );

    const updated = await this.prisma.kanbanCard.findFirst({
      where: { id: cardId, tenantId },
      include: { ...cardInclude, stage: true },
    });

    const nextStatus = statusForStage(stage.name);
    if (nextStatus && card.conversationId) {
      await this.prisma.conversation.updateMany({
        where: { id: card.conversationId, tenantId },
        data: { status: nextStatus },
      });
    }

    return updated;
  }

  async deleteCard(tenantId: string, cardId: string) {
    const card = await this.prisma.kanbanCard.findFirst({ where: { id: cardId, tenantId } });
    if (!card) throw new NotFoundException("Card não encontrado");
    await this.prisma.kanbanCard.delete({ where: { id: cardId } });
    return { ok: true };
  }

  async updateCard(
    tenantId: string,
    cardId: string,
    data: { title?: string; dealValue?: number; conversationId?: string | null },
  ) {
    const card = await this.prisma.kanbanCard.findFirst({ where: { id: cardId, tenantId } });
    if (!card) {
      throw new NotFoundException("Card não encontrado");
    }

    return this.prisma.kanbanCard.update({
      where: { id: cardId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.dealValue !== undefined ? { dealValue: new Prisma.Decimal(data.dealValue) } : {}),
        ...(data.conversationId !== undefined ? { conversationId: data.conversationId } : {}),
      },
      include: cardInclude,
    });
  }
}
