import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { CampaignJobPayload } from "@bot-wpp/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { resolveCampaignContactIds } from "./campaign-segmentation";

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("campaigns") private readonly campaignsQueue: Queue<CampaignJobPayload>,
  ) {}

  list(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { recipients: true } },
      },
    });
  }

  async getOne(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        recipients: {
          include: { contact: { select: { id: true, name: true, phone: true } } },
        },
      },
    });
    if (!campaign) {
      throw new NotFoundException("Campanha não encontrada");
    }
    return campaign;
  }

  create(
    tenantId: string,
    data: {
      name: string;
      message: string;
      tagIds?: string[];
      stageId?: string;
      scheduledAt?: string;
    },
  ) {
    return this.prisma.campaign.create({
      data: {
        tenantId,
        name: data.name,
        message: data.message,
        tagIds: data.tagIds ?? undefined,
        stageId: data.stageId,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        status: "draft",
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<{
      name: string;
      message: string;
      tagIds: string[];
      stageId: string;
      scheduledAt: string;
      status: string;
    }>,
  ) {
    await this.getOne(tenantId, id);
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.message !== undefined ? { message: data.message } : {}),
        ...(data.tagIds !== undefined ? { tagIds: data.tagIds } : {}),
        ...(data.stageId !== undefined ? { stageId: data.stageId } : {}),
        ...(data.scheduledAt !== undefined ? { scheduledAt: new Date(data.scheduledAt) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.getOne(tenantId, id);
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }

  async start(tenantId: string, campaignId: string) {
    const campaign = await this.getOne(tenantId, campaignId);
    if (campaign.status === "running") {
      throw new BadRequestException("Campanha já está em execução");
    }

    const tagIds = (campaign.tagIds as string[] | null) ?? undefined;
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId },
      include: {
        tags: { select: { id: true } },
        kanbanCards: { select: { stageId: true } },
      },
    });

    const contactIds = resolveCampaignContactIds(contacts, tagIds, campaign.stageId ?? undefined);
    if (contactIds.length === 0) {
      throw new BadRequestException("Nenhum contato encontrado para a segmentação da campanha");
    }

    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { tenantId, status: "connected" },
      orderBy: { createdAt: "asc" },
    });

    await this.prisma.campaignRecipient.deleteMany({ where: { campaignId } });

    const recipients = await Promise.all(
      contactIds.map((contactId) =>
        this.prisma.campaignRecipient.create({
          data: { tenantId, campaignId, contactId },
        }),
      ),
    );

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "running" },
    });

    for (const recipient of recipients) {
      const contact = contacts.find((c) => c.id === recipient.contactId);
      if (!contact?.phone) continue;

      await this.campaignsQueue.add("send", {
        tenantId,
        campaignId,
        recipientId: recipient.id,
        contactId: contact.id,
        phone: contact.phone,
        message: campaign.message,
        instanceId: instance?.id,
      });
    }

    return { queued: recipients.length };
  }
}
