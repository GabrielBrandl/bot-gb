import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsObject, IsOptional, IsString } from "class-validator";
import type { AuthUser } from "@bot-wpp/shared-types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ContactsService } from "./contacts.service";

class CreateContactDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class UpdateContactDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

class TagIdsDto {
  @IsArray()
  @IsString({ each: true })
  tagIds!: string[];
}

@Controller("contacts")
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("tagId") tagId?: string,
  ) {
    return this.contactsService.list(user.tenantId, { search, tagId });
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.contactsService.getOne(user.tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(user.tenantId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.contactsService.remove(user.tenantId, id);
  }

  @Post(":id/tags")
  addTags(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: TagIdsDto) {
    return this.contactsService.addTags(user.tenantId, id, dto.tagIds);
  }

  @Delete(":id/tags")
  removeTags(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: TagIdsDto) {
    return this.contactsService.removeTags(user.tenantId, id, dto.tagIds);
  }
}
