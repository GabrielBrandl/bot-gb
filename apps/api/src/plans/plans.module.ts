import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";
import { PlatformAdminService } from "./platform-admin.service";

@Module({
  imports: [AuthModule],
  controllers: [PlansController],
  providers: [PlansService, PlatformAdminService],
  exports: [PlansService, PlatformAdminService],
})
export class PlansModule {}
