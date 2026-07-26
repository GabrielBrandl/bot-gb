import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Prisma } from "@bot-wpp/database";
import { PrismaService } from "../prisma/prisma.service";
import { AsaasClient, type AsaasBillingType } from "./asaas.client";
import { MessagesService } from "../messages/messages.service";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasClient,
    private readonly messages: MessagesService,
  ) {}

  list(tenantId: string) {
    return this.prisma.payment.findMany({
      where: { tenantId },
      include: { contact: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(tenantId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: { contact: true },
    });
    if (!payment) {
      throw new NotFoundException("Pagamento não encontrado");
    }
    return payment;
  }

  async create(
    tenantId: string,
    data: {
      contactId?: string;
      phone?: string;
      amount: number;
      description?: string;
      billingType?: AsaasBillingType;
      sendViaWhatsApp?: boolean;
      conversationId?: string;
    },
  ) {
    let contactId = data.contactId;

    if (!contactId && data.phone) {
      const phone = data.phone.replace(/\D/g, "");
      const contact = await this.prisma.contact.upsert({
        where: { tenantId_phone: { tenantId, phone } },
        update: {},
        create: { tenantId, phone, name: phone },
      });
      contactId = contact.id;
    }

    if (!contactId) {
      throw new BadRequestException("Informe contactId ou phone");
    }

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) {
      throw new NotFoundException("Contato não encontrado");
    }

    const billingType = data.billingType ?? "UNDEFINED";
    const description = data.description ?? "Pagamento ABS Resolve";

    const asaasPayment = await this.asaas.createCharge({
      customerName: contact.name ?? contact.phone,
      customerPhone: contact.phone,
      value: data.amount,
      description,
      billingType,
      externalReference: `${tenantId}:${contact.id}`,
    });

    const link =
      asaasPayment.invoiceUrl ??
      asaasPayment.url ??
      asaasPayment.bankSlipUrl ??
      "https://sandbox.asaas.com/pagamento-pendente";

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        contactId: contact.id,
        amount: new Prisma.Decimal(data.amount),
        status: "pending",
        billingType,
        description,
        externalId: asaasPayment.id,
        link,
        bankSlipUrl: asaasPayment.bankSlipUrl ?? null,
        invoiceUrl: asaasPayment.invoiceUrl ?? asaasPayment.url ?? null,
      },
      include: { contact: true },
    });

    if (data.sendViaWhatsApp) {
      const conversation =
        (data.conversationId
          ? await this.prisma.conversation.findFirst({
              where: { id: data.conversationId, tenantId },
            })
          : null) ??
        (await this.prisma.conversation.findFirst({
          where: { tenantId, contactId: contact.id },
          orderBy: { updatedAt: "desc" },
        }));

      if (conversation) {
        const typeLabel =
          billingType === "BOLETO"
            ? "boleto"
            : billingType === "PIX"
              ? "Pix"
              : billingType === "CREDIT_CARD"
                ? "cartão"
                : "pagamento";

        const amountFmt = Number(data.amount).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });

        let text = `Olá! Segue seu link de ${typeLabel} no valor de ${amountFmt}:\n${link}`;
        if (billingType === "BOLETO" && payment.bankSlipUrl) {
          text += `\n\nPDF do boleto: ${payment.bankSlipUrl}`;
        }

        await this.messages.sendText(tenantId, conversation.id, text);
      }
    }

    return payment;
  }

  async handleWebhook(body: Record<string, unknown>) {
    const event = body.event as string | undefined;
    const paymentData = body.payment as {
      id?: string;
      status?: string;
      externalReference?: string;
    } | undefined;

    if (!paymentData?.id) {
      return { ok: true, skipped: true };
    }

    const statusMap: Record<string, string> = {
      RECEIVED: "paid",
      CONFIRMED: "paid",
      OVERDUE: "expired",
      REFUNDED: "cancelled",
      DELETED: "cancelled",
    };

    const status = statusMap[paymentData.status ?? ""] ?? "pending";

    await this.prisma.payment.updateMany({
      where: { externalId: paymentData.id },
      data: { status },
    });

    return { ok: true, event, status };
  }
}
