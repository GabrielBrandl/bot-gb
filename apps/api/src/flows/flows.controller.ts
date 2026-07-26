import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsObject, IsOptional, IsString, MinLength } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { FlowsService } from "./flows.service";

class CreateFlowDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  trigger!: string;

  @IsObject()
  nodes!: { nodes: unknown[]; edges: unknown[] };

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class UpdateFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  @IsObject()
  nodes?: { nodes: unknown[]; edges: unknown[] };

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@Controller("flows")
@UseGuards(JwtAuthGuard)
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.flowsService.list(user.tenantId);
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.flowsService.getOne(user.tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFlowDto) {
    return this.flowsService.create(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateFlowDto) {
    return this.flowsService.update(user.tenantId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.flowsService.remove(user.tenantId, id);
  }
}
