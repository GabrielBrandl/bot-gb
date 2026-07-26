import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";
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
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.paymentsService.list(user.tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user.tenantId, dto);
  }

  @Public()
  @Post("webhook/asaas")
  webhook(@Body() body: Record<string, unknown>) {
    return this.paymentsService.handleWebhook(body);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.paymentsService.getOne(user.tenantId, id);
  }
}
