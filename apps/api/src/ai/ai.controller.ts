import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AiService } from "./ai.service";
import { KnowledgeService } from "./knowledge.service";

class CreateAgentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  persona!: string;

  @IsString()
  modelProvider!: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  persona?: string;

  @IsOptional()
  @IsString()
  modelProvider?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class AskDto {
  @IsString()
  @MinLength(1)
  question!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  @Get("agents")
  listAgents(@CurrentUser() user: AuthUser) {
    return this.aiService.listAgents(user.tenantId);
  }

  @Post("agents")
  createAgent(@CurrentUser() user: AuthUser, @Body() dto: CreateAgentDto) {
    return this.aiService.createAgent(user.tenantId, dto);
  }

  @Patch("agents/:id")
  updateAgent(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAgentDto) {
    return this.aiService.updateAgent(user.tenantId, id, dto);
  }

  @Delete("agents/:id")
  removeAgent(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.aiService.removeAgent(user.tenantId, id);
  }

  @Post("agents/:id/ask")
  ask(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AskDto) {
    return this.aiService.askAgent(user.tenantId, id, dto);
  }

  @Get("suggest-reply/:conversationId")
  suggestReply(
    @CurrentUser() user: AuthUser,
    @Param("conversationId") conversationId: string,
    @Query("agentId") agentId?: string,
  ) {
    return this.aiService.suggestReply(user.tenantId, conversationId, agentId);
  }

  @Get("knowledge")
  listKnowledge(@CurrentUser() user: AuthUser, @Query("agentId") agentId?: string) {
    return this.knowledgeService.listDocuments(user.tenantId, agentId);
  }

  @Post("knowledge")
  createKnowledge(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.knowledgeService.createDocument(user.tenantId, dto);
  }

  @Delete("knowledge/:id")
  deleteKnowledge(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.knowledgeService.deleteDocument(user.tenantId, id);
  }
}
