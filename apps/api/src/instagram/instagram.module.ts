import { Module, forwardRef } from "@nestjs/common";
import { FlowsModule } from "../flows/flows.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { InstagramController } from "./instagram.controller";
import { InstagramService } from "./instagram.service";

@Module({
  imports: [RealtimeModule, forwardRef(() => FlowsModule)],
  controllers: [InstagramController],
  providers: [InstagramService],
  exports: [InstagramService],
})
export class InstagramModule {}
