import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
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

  @IsOptional()
  @IsString()
  modelProvider?: string;

  /** Frontend alias for modelProvider */
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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
  provider?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

function toAgentResponse<T extends { modelProvider: string; active: boolean }>(agent: T) {
  return {
    ...agent,
    provider: agent.modelProvider,
    isActive: agent.active,
  };
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
  async listAgents(@CurrentUser() user: AuthUser) {
    const agents = await this.aiService.listAgents(user.tenantId);
    return agents.map(toAgentResponse);
  }

  @Post("agents")
  async createAgent(@CurrentUser() user: AuthUser, @Body() dto: CreateAgentDto) {
    const modelProvider = dto.modelProvider || dto.provider;
    if (!modelProvider) {
      throw new BadRequestException("Informe o provedor de IA (provider)");
    }
    const agent = await this.aiService.createAgent(user.tenantId, {
      name: dto.name,
      persona: dto.persona,
      modelProvider,
      systemPrompt: dto.systemPrompt,
      active: dto.isActive ?? dto.active,
    });
    return toAgentResponse(agent);
  }

  @Patch("agents/:id")
  async updateAgent(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateAgentDto,
  ) {
    const agent = await this.aiService.updateAgent(user.tenantId, id, {
      name: dto.name,
      persona: dto.persona,
      modelProvider: dto.modelProvider || dto.provider,
      systemPrompt: dto.systemPrompt,
      active: dto.isActive ?? dto.active,
    });
    return toAgentResponse(agent);
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
