import { Module } from "@nestjs/common";
import { PlansController } from "./plans.controller";
import { PlansService, PlatformAdminService } from "./plans.service";

@Module({
  controllers: [PlansController],
  providers: [PlansService, PlatformAdminService],
  exports: [PlansService, PlatformAdminService],
})
export class PlansModule {}
