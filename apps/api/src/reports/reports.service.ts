import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(tenantId: string) {
    const [
      messagesCount,
      conversationsOpen,
      conversationsPending,
      conversationsClosed,
      paymentsAgg,
      campaignsTotal,
      campaignsRunning,
      campaignRecipientsSent,
      contactsCount,
    ] = await Promise.all([
      this.prisma.message.count({ where: { tenantId } }),
      this.prisma.conversation.count({ where: { tenantId, status: "open" } }),
      this.prisma.conversation.count({ where: { tenantId, status: "pending" } }),
      this.prisma.conversation.count({ where: { tenantId, status: "closed" } }),
      this.prisma.payment.aggregate({
        where: { tenantId, status: "paid" },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.campaign.count({ where: { tenantId } }),
      this.prisma.campaign.count({ where: { tenantId, status: "running" } }),
      this.prisma.campaignRecipient.count({ where: { tenantId, status: "sent" } }),
      this.prisma.contact.count({ where: { tenantId } }),
    ]);

    return {
      messages: messagesCount,
      conversations: {
        open: conversationsOpen,
        pending: conversationsPending,
        closed: conversationsClosed,
        total: conversationsOpen + conversationsPending + conversationsClosed,
      },
      payments: {
        count: paymentsAgg._count,
        totalPaid: paymentsAgg._sum.amount?.toNumber() ?? 0,
      },
      campaigns: {
        total: campaignsTotal,
        running: campaignsRunning,
        messagesSent: campaignRecipientsSent,
      },
      contacts: contactsCount,
    };
  }
}
