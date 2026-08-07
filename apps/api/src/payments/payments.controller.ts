import { Body, Controller, Get, Headers, Param, Post, UseGuards, UnauthorizedException } from "@nestjs/common";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PaymentsService } from "./payments.service";
import type { AsaasBillingType } from "./asaas.client";

class CreatePaymentDto {
  @IsOptional()
  @IsString()
  contactId?: string;

  @ValidateIf((o: CreatePaymentDto) => !o.contactId)
  @IsString()
  phone?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(["PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED"])
  billingType?: AsaasBillingType;

  @IsOptional()
  @IsBoolean()
  sendViaWhatsApp?: boolean;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.paymentsService.list(user.tenantId);
  }

  @Get("config")
  @UseGuards(JwtAuthGuard)
  config() {
    return this.paymentsService.getConfig();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user.tenantId, dto);
  }

  @Public()
  @Post("webhook/asaas")
  webhook(
    @Headers("asaas-access-token") asaasToken: string | undefined,
    @Headers("x-webhook-secret") secretHeader: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const expected =
      this.configService.get<string>("ASAAS_WEBHOOK_TOKEN")?.trim() ||
      this.configService.get<string>("ASAAS_API_KEY")?.trim();
    const provided = (asaasToken || secretHeader || "").trim();
    const isProd =
      Boolean(this.configService.get<string>("PUBLIC_API_URL")?.trim()) ||
      process.env.NODE_ENV === "production";

    if (expected) {
      if (!provided || provided !== expected) {
        throw new UnauthorizedException("Webhook Asaas não autorizado");
      }
    } else if (isProd) {
      throw new UnauthorizedException("Token de webhook Asaas não configurado");
    }

    return this.paymentsService.handleWebhook(body);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.paymentsService.getOne(user.tenantId, id);
  }
}
