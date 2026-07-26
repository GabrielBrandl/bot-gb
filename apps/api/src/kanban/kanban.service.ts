import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@bot-wpp/database";
import { PrismaService } from "../prisma/prisma.service";

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
              include: {
                contact: { select: { id: true, name: true, phone: true } },
                conversation: { select: { id: true, status: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async createCard(
    tenantId: string,
    data: {
      stageId: string;
      contactId: string;
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

    const maxOrder = await this.prisma.kanbanCard.aggregate({
      where: { stageId: data.stageId },
      _max: { order: true },
    });

    return this.prisma.kanbanCard.create({
      data: {
        tenantId,
        stageId: data.stageId,
        contactId: data.contactId,
        title: data.title,
        conversationId: data.conversationId,
        dealValue: data.dealValue !== undefined ? new Prisma.Decimal(data.dealValue) : undefined,
        order: (maxOrder._max.order ?? -1) + 1,
      },
      include: { contact: true },
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

    return this.prisma.kanbanCard.update({
      where: { id: cardId },
      data: { stageId, order },
      include: { contact: true, stage: true },
    });
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
      include: { contact: true },
    });
  }
}
