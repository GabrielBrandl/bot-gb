import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { EvolutionClient } from "../whatsapp/evolution.client";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({
  imports: [RealtimeModule],
  controllers: [MessagesController],
  providers: [MessagesService, EvolutionClient],
  exports: [MessagesService],
})
export class MessagesModule {}
