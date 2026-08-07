import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, Matches, MinLength } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuditService } from "../audit/audit.service";
import { TenantsService } from "./tenants.service";

class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor?: string;
}

@Controller("tenants")
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly auditService: AuditService,
  ) {}

  @Get("me")
  getMine(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getById(user.tenantId);
  }

  @Patch("me")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async updateMine(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantDto) {
    const updated = await this.tenantsService.update(user.tenantId, dto);
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "tenant.update",
      entity: "Tenant",
      entityId: user.tenantId,
      meta: dto as object,
    });
    return updated;
  }
}
