import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import type { CampaignJobPayload } from "@bot-wpp/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { EvolutionClient } from "../whatsapp/evolution.client";

@Processor("campaigns")
export class CampaignsProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
  ) {
    super();
  }

  async process(job: Job<CampaignJobPayload>): Promise<void> {
    const { tenantId, recipientId, phone, message, instanceId } = job.data;

    try {
      let sent = false;

      if (instanceId) {
        const instance = await this.prisma.whatsappInstance.findFirst({
          where: { id: instanceId, tenantId },
        });

        if (
          instance &&
          instance.status === "connected" &&
          !instance.evolutionInstanceId.startsWith("demo-")
        ) {
          await this.evolution.sendText(instance.evolutionInstanceId, phone, message);
          sent = true;
        }
      }

      await this.prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          status: sent ? "sent" : "pending",
          sentAt: sent ? new Date() : null,
          error: sent ? null : "Instância demo/desconectada — mensagem registrada como pendente",
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
      this.logger.error(`Campaign job failed: ${errMsg}`);
      await this.prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: { status: "failed", error: errMsg },
      });
    }
  }
}
