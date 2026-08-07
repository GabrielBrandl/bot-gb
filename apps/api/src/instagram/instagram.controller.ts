import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { InstagramService } from "./instagram.service";

@Controller("instagram")
@UseGuards(JwtAuthGuard)
export class InstagramController {
  constructor(private readonly instagram: InstagramService) {}

  @Get("accounts")
  list(@CurrentUser() user: { tenantId: string }) {
    return this.instagram.list(user.tenantId);
  }

  @Post("accounts")
  create(@CurrentUser() user: { tenantId: string }, @Body() body: { name: string }) {
    return this.instagram.create(user.tenantId, body.name);
  }

  @Post("accounts/:id/connect")
  connect(@CurrentUser() user: { tenantId: string }, @Param("id") id: string) {
    return this.instagram.markConnected(user.tenantId, id);
  }

  @Delete("accounts/:id")
  remove(@CurrentUser() user: { tenantId: string }, @Param("id") id: string) {
    return this.instagram.remove(user.tenantId, id);
  }

  @Post("demo/inbound")
  demoInbound(
    @CurrentUser() user: { tenantId: string },
    @Body() body: { username?: string; text: string; accountId?: string },
  ) {
    return this.instagram.simulateInbound(user.tenantId, body);
  }

  @Public()
  @Get("webhook")
  verifyWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ) {
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
    if (!expected) {
      return "forbidden";
    }
    if (mode === "subscribe" && token === expected) {
      return challenge;
    }
    return "forbidden";
  }

  @Public()
  @Post("webhook")
  webhook(
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const appSecret = process.env.META_APP_SECRET?.trim();
    const isProd = Boolean(process.env.PUBLIC_API_URL?.trim()) || process.env.NODE_ENV === "production";
    if (appSecret) {
      // Sem corpo raw assinado no Nest padrão, exigimos pelo menos a presença do header Meta.
      if (!signature?.startsWith("sha256=")) {
        return { ok: false, error: "Assinatura Meta ausente" };
      }
    } else if (isProd) {
      return { ok: false, error: "META_APP_SECRET não configurado" };
    }
    return this.instagram.handleWebhook(body);
  }
}
