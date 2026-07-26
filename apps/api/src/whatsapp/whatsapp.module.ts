import { Module, forwardRef } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { FlowsModule } from "../flows/flows.module";
import { EvolutionClient } from "./evolution.client";
import { WhatsappController } from "./whatsapp.controller";
import { WhatsappService } from "./whatsapp.service";

@Module({
  imports: [RealtimeModule, forwardRef(() => FlowsModule)],
  controllers: [WhatsappController],
  providers: [WhatsappService, EvolutionClient],
  exports: [WhatsappService, EvolutionClient],
})
export class WhatsappModule {}
