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
    ]);

    // Flat shape consumed by Dashboard + Relatórios (ABS Resolve admin UI).
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
    };
  }
}
