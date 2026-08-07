import { Body, Controller, Get, Param, Patch, Post, UseGuards, BadRequestException } from "@nestjs/common";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PlansService } from "./plans.service";
import { PlatformAdminService } from "./platform-admin.service";

class ChangePlanDto {
  @IsString()
  @IsIn(["STARTER", "PRO", "ENTERPRISE"])
  planId!: "STARTER" | "PRO" | "ENTERPRISE";
}

class BillingStatusDto {
  @IsString()
  @IsIn(["trialing", "active", "past_due", "canceled", "suspended"])
  billingStatus!: "trialing" | "active" | "past_due" | "canceled" | "suspended";
}

class CreateTenantDto {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsString()
  @MinLength(2)
  adminName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(6)
  adminPassword!: string;

  @IsString()
  @IsIn(["STARTER", "PRO", "ENTERPRISE"])
  planId!: "STARTER" | "PRO" | "ENTERPRISE";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxAgents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxWhatsapp?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxInstagram?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxContacts?: number;

  @IsOptional()
  @IsIn(["trialing", "active", "past_due", "canceled", "suspended"])
  billingStatus?: "trialing" | "active" | "past_due" | "canceled" | "suspended";
}

class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(["STARTER", "PRO", "ENTERPRISE"])
  planId?: "STARTER" | "PRO" | "ENTERPRISE";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxAgents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxWhatsapp?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxInstagram?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxContacts?: number;

  @IsOptional()
  @IsIn(["trialing", "active", "past_due", "canceled", "suspended"])
  billingStatus?: "trialing" | "active" | "past_due" | "canceled" | "suspended";

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}

class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(["ADMIN", "SUPERVISOR", "AGENT"])
  role!: "ADMIN" | "SUPERVISOR" | "AGENT";
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(["ADMIN", "SUPERVISOR", "AGENT"])
  role?: "ADMIN" | "SUPERVISOR" | "AGENT";

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
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

  @Public()
  @Get("tenants/by-slug/:slug")
  tenantBySlug(@Param("slug") slug: string) {
    return this.platform.getPublicBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("plans/subscribe")
  async subscribe(@CurrentUser() user: AuthUser, @Body() dto: ChangePlanDto) {
    if (user.impersonating) {
      throw new BadRequestException("Não é possível alterar plano em sessão de acesso à empresa");
    }
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
  @Get("platform/tenants/:id")
  async tenantDetail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.platform.assertOwner(user.id);
    return this.platform.getTenant(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Post("platform/tenants")
  async createTenant(@CurrentUser() user: AuthUser, @Body() dto: CreateTenantDto) {
    await this.platform.assertOwner(user.id);
    return this.platform.createTenant(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Patch("platform/tenants/:id")
  async updateTenant(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    await this.platform.assertOwner(user.id);
    return this.platform.updateTenant(id, dto);
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Post("platform/tenants/:id/users")
  async createUser(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateUserDto,
  ) {
    await this.platform.assertOwner(user.id);
    return this.platform.createUser(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Patch("platform/tenants/:tenantId/users/:userId")
  async updateUser(
    @CurrentUser() user: AuthUser,
    @Param("tenantId") tenantId: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    await this.platform.assertOwner(user.id);
    return this.platform.updateUser(tenantId, userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Post("platform/tenants/:id/access-link")
  async accessLink(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.platform.assertOwner(user.id);
    return this.platform.createAccessLink(user.id, id);
  }

  @Public()
  @Post("platform/access/exchange")
  exchangeAccess(@Body() body: { code?: string }) {
    if (!body?.code) {
      throw new BadRequestException("Código obrigatório");
    }
    return this.platform.exchangeAccessCode(body.code);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Post("platform/tenants/:id/impersonate")
  async impersonate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.platform.assertOwner(user.id);
    return this.platform.impersonate(user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("PLATFORM_OWNER")
  @Post("platform/stop-impersonation")
  async stopImpersonation(@CurrentUser() user: AuthUser) {
    await this.platform.assertOwner(user.id);
    return this.platform.stopImpersonation(user.id);
  }
}
