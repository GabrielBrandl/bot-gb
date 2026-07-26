import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EvolutionClient } from "../whatsapp/evolution.client";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsProcessor } from "./campaigns.processor";
import { CampaignsService } from "./campaigns.service";

@Module({
  imports: [BullModule.registerQueue({ name: "campaigns" })],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignsProcessor, EvolutionClient],
  exports: [CampaignsService],
})
export class CampaignsModule {}
