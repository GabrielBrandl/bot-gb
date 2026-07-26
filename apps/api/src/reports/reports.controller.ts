import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("overview")
  overview(@CurrentUser() user: AuthUser) {
    return this.reportsService.getOverview(user.tenantId);
  }
}
