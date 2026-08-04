import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { MessagesService } from "./messages.service";

class SendMessageDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  /** Accepted for frontend compatibility; persisted type is derived server-side. */
  @IsOptional()
  @IsString()
  type?: string;
}

@Controller("conversations/:conversationId/messages")
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.messagesService.list(user.tenantId, conversationId);
  }

  @Post()
  send(
    @CurrentUser() user: AuthUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendText(
      user.tenantId,
      conversationId,
      dto.content,
      dto.mediaUrl,
      { id: user.id, name: user.name },
    );
  }
}
