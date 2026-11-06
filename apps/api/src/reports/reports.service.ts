import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(tenantId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      messagesToday,
      messagesInbound,
      messagesOutbound,
      conversationsOpen,
      conversationsPending,
      conversationsClosed,
      paymentsPending,
      paymentsPaid,
      campaignsActive,
      contactsTotal,
      csatGroups,
    ] = await Promise.all([
      this.prisma.message.count({
        where: { tenantId, createdAt: { gte: startOfDay } },
      }),
      this.prisma.message.count({ where: { tenantId, direction: "inbound" } }),
      this.prisma.message.count({ where: { tenantId, direction: "outbound" } }),
      this.prisma.conversation.count({ where: { tenantId, status: "open" } }),
      this.prisma.conversation.count({ where: { tenantId, status: "pending" } }),
      this.prisma.conversation.count({ where: { tenantId, status: "closed" } }),
      this.prisma.payment.count({ where: { tenantId, status: "pending" } }),
      this.prisma.payment.count({ where: { tenantId, status: "paid" } }),
      this.prisma.campaign.count({ where: { tenantId, status: "running" } }),
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.conversation.groupBy({
        by: ["csatScore"],
        where: { tenantId, csatScore: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const scores = [1, 2, 3, 4, 5].map((score) => {
      const row = csatGroups.find((item) => item.csatScore === score);
      return { score, count: row?._count._all ?? 0 };
    });
    const csatTotal = scores.reduce((sum, item) => sum + item.count, 0);
    const csatAverage =
      csatTotal === 0
        ? null
        : Math.round((scores.reduce((sum, item) => sum + item.score * item.count, 0) / csatTotal) * 10) / 10;

    // Flat shape consumed by Dashboard + Relatórios (GB Systems admin UI).
    return {
      conversationsOpen,
      conversationsPending,
      conversationsClosed,
      messagesToday,
      messagesInbound,
      messagesOutbound,
      contactsTotal,
      campaignsActive,
      paymentsPending,
      paymentsPaid,
      csatAverage,
      csatTotal,
      csatScores: scores,
    };
  }
}
