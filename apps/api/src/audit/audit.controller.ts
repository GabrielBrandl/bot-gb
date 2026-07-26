import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuditService } from "./audit.service";

@Controller("audit")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles("ADMIN")
  async list(
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
    const [items, total] = await Promise.all([
      this.auditService.list(user.tenantId, pageNum, limitNum),
      this.auditService.count(user.tenantId),
    ]);
    return { items, total, page: pageNum, limit: limitNum };
  }
}
