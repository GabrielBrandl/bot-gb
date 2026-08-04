import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { UsersService } from "./users.service";

class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(["ADMIN", "SUPERVISOR", "AGENT"])
  role!: "ADMIN" | "SUPERVISOR" | "AGENT";
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(["ADMIN", "SUPERVISOR", "AGENT"])
  role?: "ADMIN" | "SUPERVISOR" | "AGENT";

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles("ADMIN", "SUPERVISOR", "PLATFORM_OWNER")
  list(@CurrentUser() user: AuthUser) {
    return this.usersService.listByTenant(user.tenantId);
  }

  @Post()
  @Roles("ADMIN", "PLATFORM_OWNER")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.tenantId, dto);
  }

  @Patch(":id")
  @Roles("ADMIN", "PLATFORM_OWNER")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.tenantId, id, dto);
  }
}
