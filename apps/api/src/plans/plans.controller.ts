import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsIn, IsString } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PlansService, PlatformAdminService } from "./plans.service";

class ChangePlanDto {
  @IsString()
  @IsIn(["STARTER", "PRO", "ENTERPRISE"])
  planId!: string;
}

class BillingStatusDto {
  @IsString()
  @IsIn(["trialing", "active", "past_due", "canceled", "suspended"])
  billingStatus!: string;
}

@Controller()
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly platform: PlatformAdminService,
  ) {}

  @Public()
  @Get("plans")
  async listPlans() {
    const plans = await this.plans.listPublic();
    return plans.map((p) => this.plans.serialize(p));
  }

  @UseGuards(JwtAuthGuard)
  @Post("plans/subscribe")
  async subscribe(@CurrentUser() user: AuthUser, @Body() dto: ChangePlanDto) {
    const tenant = await this.plans.applyToTenant(user.tenantId, dto.planId);
    return {
      tenant,
      plan: this.plans.serialize(tenant.planRef),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Get("platform/overview")
  async overview(@CurrentUser() user: AuthUser) {
    await this.platform.assertOwner(user.id);
    return this.platform.overview();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Get("platform/tenants")
  async tenants(@CurrentUser() user: AuthUser) {
    await this.platform.assertOwner(user.id);
    return this.platform.listTenants();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Patch("platform/tenants/:id/plan")
  async changeTenantPlan(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ChangePlanDto,
  ) {
    await this.platform.assertOwner(user.id);
    return this.platform.updateTenantPlan(id, dto.planId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Patch("platform/tenants/:id/billing")
  async changeBilling(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: BillingStatusDto,
  ) {
    await this.platform.assertOwner(user.id);
    return this.platform.setTenantStatus(id, dto.billingStatus);
  }
}
