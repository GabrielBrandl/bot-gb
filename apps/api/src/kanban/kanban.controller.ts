import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsNumber, IsOptional, IsString } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { KanbanService } from "./kanban.service";

class CreateCardDto {
  @IsString()
  stageId!: string;

  @IsString()
  contactId!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsNumber()
  dealValue?: number;
}

class MoveCardDto {
  @IsString()
  stageId!: string;

  @IsNumber()
  order!: number;
}

class UpdateCardDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  dealValue?: number;

  @IsOptional()
  @IsString()
  conversationId?: string | null;
}

@Controller("kanban")
@UseGuards(JwtAuthGuard)
export class KanbanController {
  constructor(private readonly kanbanService: KanbanService) {}

  @Get("boards")
  getBoards(@CurrentUser() user: AuthUser) {
    return this.kanbanService.getBoards(user.tenantId);
  }

  /** Frontend expects a single board at /kanban/board */
  @Get("board")
  getBoard(@CurrentUser() user: AuthUser) {
    return this.kanbanService.getBoard(user.tenantId);
  }

  @Post("cards")
  createCard(@CurrentUser() user: AuthUser, @Body() dto: CreateCardDto) {
    return this.kanbanService.createCard(user.tenantId, dto);
  }

  @Patch("cards/:id/move")
  moveCard(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: MoveCardDto) {
    return this.kanbanService.moveCard(user.tenantId, id, dto.stageId, dto.order);
  }

  @Patch("cards/:id")
  updateCard(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCardDto) {
    return this.kanbanService.updateCard(user.tenantId, id, dto);
  }
}
