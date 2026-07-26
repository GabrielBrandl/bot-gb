import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WhatsappService } from "./whatsapp.service";

class CreateInstanceDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

class DemoInboundDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  instanceId?: string;
}

@Controller("whatsapp")
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get("instances")
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.whatsappService.listInstances(user.tenantId);
  }

  @Post("instances")
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInstanceDto) {
    return this.whatsappService.createInstance(user.tenantId, dto.name);
  }

  @Get("instances/:id/qr")
  @UseGuards(JwtAuthGuard)
  getQr(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.whatsappService.getQrCode(user.tenantId, id);
  }

  @Post("instances/:id/refresh")
  @UseGuards(JwtAuthGuard)
  refresh(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.whatsappService.refreshStatus(user.tenantId, id);
  }

  @Delete("instances/:id")
  @UseGuards(JwtAuthGuard)
  disconnect(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.whatsappService.disconnect(user.tenantId, id);
  }

  @Public()
  @Post("webhook")
  webhook(@Body() body: Record<string, unknown>) {
    return this.whatsappService.processWebhook(body);
  }

  @Post("demo/inbound")
  @UseGuards(JwtAuthGuard)
  demoInbound(@CurrentUser() user: AuthUser, @Body() dto: DemoInboundDto) {
    return this.whatsappService.demoInbound(user.tenantId, dto);
  }
}
