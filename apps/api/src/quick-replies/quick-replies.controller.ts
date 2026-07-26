import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { QuickRepliesService } from "./quick-replies.service";

class CreateQuickReplyDto {
  @IsString()
  @MinLength(1)
  shortcut!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}

class UpdateQuickReplyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  shortcut?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;
}

@Controller("quick-replies")
@UseGuards(JwtAuthGuard)
export class QuickRepliesController {
  constructor(private readonly quickRepliesService: QuickRepliesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.quickRepliesService.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateQuickReplyDto) {
    return this.quickRepliesService.create(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateQuickReplyDto) {
    return this.quickRepliesService.update(user.tenantId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.quickRepliesService.remove(user.tenantId, id);
  }
}
