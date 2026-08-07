import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UseGuards, UnauthorizedException } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WhatsappService } from "./whatsapp.service";

class CreateInstanceDto {
  @IsString()
  @MinLength(2)
  name!: string;

  /** Opcional — legado. Conexão padrão é via QR (estilo WhatsApp Web), sem número. */
  @IsOptional()
  @IsString()
  phone?: string;
}

class PairingCodeDto {
  /** Opcional. Sem número, a API gera QR Code (fluxo WhatsApp Web). */
  @IsOptional()
  @IsString()
  phone?: string;
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
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  @Get("instances")
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.whatsappService.listInstances(user.tenantId);
  }

  @Get("evolution/status")
  @UseGuards(JwtAuthGuard)
  evolutionStatus() {
    return this.whatsappService.evolutionStatus();
  }

  @Post("instances")
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInstanceDto) {
    return this.whatsappService.createInstance(user.tenantId, dto.name, dto.phone);
  }

  @Post("instances/:id/provision")
  @UseGuards(JwtAuthGuard)
  provision(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.whatsappService.provisionInstance(user.tenantId, id);
  }

  @Get("instances/:id/qr")
  @UseGuards(JwtAuthGuard)
  getQr(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("phone") phone?: string,
  ) {
    return this.whatsappService.getQrCode(user.tenantId, id, phone);
  }

  @Post("instances/:id/pairing")
  @UseGuards(JwtAuthGuard)
  pairing(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: PairingCodeDto,
  ) {
    return this.whatsappService.getPairingCode(user.tenantId, id, dto.phone);
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
  webhook(
    @Headers("x-webhook-secret") secretHeader: string | undefined,
    @Headers("apikey") apiKeyHeader: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const expected = (
      this.config.get<string>("EVOLUTION_WEBHOOK_SECRET") ||
      process.env.EVOLUTION_WEBHOOK_SECRET ||
      ""
    ).trim();
    const provided = (secretHeader || apiKeyHeader || "").trim();
    const isProd =
      Boolean(this.config.get<string>("PUBLIC_API_URL")?.trim() || process.env.PUBLIC_API_URL) ||
      process.env.NODE_ENV === "production";

    if (expected) {
      if (!provided || provided !== expected) {
        throw new UnauthorizedException("Webhook não autorizado");
      }
    } else if (isProd) {
      throw new UnauthorizedException("EVOLUTION_WEBHOOK_SECRET não configurado");
    }

    return this.whatsappService.processWebhook(body);
  }

  @Post("demo/inbound")
  @UseGuards(JwtAuthGuard)
  demoInbound(@CurrentUser() user: AuthUser, @Body() dto: DemoInboundDto) {
    return this.whatsappService.demoInbound(user.tenantId, dto);
  }
}
