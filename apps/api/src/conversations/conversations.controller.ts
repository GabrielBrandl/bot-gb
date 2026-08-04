import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ConversationsService } from "./conversations.service";

class UpdateStatusDto {
  @IsIn(["open", "pending", "closed"])
  status!: "open" | "pending" | "closed";
}

class AssignDto {
  @IsOptional()
  @IsString()
  assignedTo?: string | null;
}

class TransferDto {
  @IsString()
  assignedTo!: string;
}

class InternalNoteDto {
  @IsString()
  @MinLength(1)
  content!: string;
}

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("status") status?: string,
    @Query("assignedTo") assignedTo?: string,
    @Query("search") search?: string,
    @Query("channel") channel?: string,
  ) {
    return this.conversationsService.list(user.tenantId, { status, assignedTo, search, channel });
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.conversationsService.getOne(user.tenantId, id);
  }

  @Patch(":id/assign")
  assign(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AssignDto) {
    return this.conversationsService.assign(user.tenantId, id, dto.assignedTo ?? null);
  }

  @Post(":id/transfer")
  transfer(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: TransferDto) {
    return this.conversationsService.transfer(user.tenantId, id, dto.assignedTo);
  }

  @Patch(":id/status")
  updateStatus(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateStatusDto) {
    return this.conversationsService.updateStatus(user.tenantId, id, dto.status);
  }

  @Post(":id/notes")
  addNote(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: InternalNoteDto) {
    return this.conversationsService.addInternalNote(user.tenantId, id, dto.content);
  }
}
