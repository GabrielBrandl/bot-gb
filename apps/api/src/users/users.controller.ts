import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles("ADMIN", "SUPERVISOR")
  list(@CurrentUser() user: AuthUser): ReturnType<UsersService["listByTenant"]> {
    return this.usersService.listByTenant(user.tenantId);
  }
}
