import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsOptional, IsString, MinLength } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuditService } from "../audit/audit.service";
import { CampaignsService } from "./campaigns.service";

class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsString()
  stageId?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsString()
  stageId?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

@Controller("campaigns")
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.campaignsService.list(user.tenantId);
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.campaignsService.getOne(user.tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(user.tenantId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.campaignsService.remove(user.tenantId, id);
  }

  @Post(":id/start")
  async start(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const result = await this.campaignsService.start(user.tenantId, id);
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "campaign.start",
      entity: "Campaign",
      entityId: id,
      meta: result as object,
    });
    return result;
  }
}
