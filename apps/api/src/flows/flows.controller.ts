import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsObject, IsOptional, IsString, MinLength, ValidateIf } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { extractTriggerFromGraph, toFlowResponse } from "./flows.mapper";
import { FlowsService } from "./flows.service";

class CreateFlowDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

  /** Frontend sends `graph`; legacy clients may send `nodes`. */
  @ValidateIf((o: CreateFlowDto) => !o.nodes)
  @IsObject()
  graph?: { nodes: unknown[]; edges: unknown[] };

  @ValidateIf((o: CreateFlowDto) => !o.graph)
  @IsObject()
  nodes?: { nodes: unknown[]; edges: unknown[] };

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  @IsObject()
  graph?: { nodes: unknown[]; edges: unknown[] };

  @IsOptional()
  @IsObject()
  nodes?: { nodes: unknown[]; edges: unknown[] };

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller("flows")
@UseGuards(JwtAuthGuard)
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const flows = await this.flowsService.list(user.tenantId);
    return flows.map(toFlowResponse);
  }

  @Get(":id")
  async getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const flow = await this.flowsService.getOne(user.tenantId, id);
    return toFlowResponse(flow);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateFlowDto) {
    const graph = dto.graph ?? dto.nodes ?? { nodes: [], edges: [] };
    const trigger =
      dto.trigger?.trim() ||
      dto.description?.trim() ||
      extractTriggerFromGraph(graph as { nodes?: Array<{ type?: string; data?: Record<string, unknown> }> });

    const flow = await this.flowsService.create(user.tenantId, {
      name: dto.name,
      trigger,
      nodes: graph,
      active: dto.isActive ?? dto.active ?? true,
    });
    return toFlowResponse(flow);
  }

  @Patch(":id")
  async update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateFlowDto) {
    const graph = dto.graph ?? dto.nodes;
    const flow = await this.flowsService.update(user.tenantId, id, {
      name: dto.name,
      trigger: dto.trigger?.trim() || dto.description?.trim(),
      nodes: graph,
      active: dto.isActive ?? dto.active,
    });
    return toFlowResponse(flow);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.flowsService.remove(user.tenantId, id);
  }
}
