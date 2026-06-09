import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import { Roles } from '../common/decorators/roles.decorator';

import { RolesService } from './roles.service';

import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /*
   |--------------------------------------------------------------------------
   | CREATE
   |--------------------------------------------------------------------------
   */

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  /*
   |--------------------------------------------------------------------------
   | LIST
   |--------------------------------------------------------------------------
   */

  @Get()
  @Roles('SUPER_ADMIN')
  findAll() {
    return this.rolesService.findAll();
  }

  /*
   |--------------------------------------------------------------------------
   | FIND ONE
   |--------------------------------------------------------------------------
   */

  @Get(':id')
  @Roles('SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  /*
   |--------------------------------------------------------------------------
   | UPDATE
   |--------------------------------------------------------------------------
   */

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @Param('id') id: string,

    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, dto);
  }

  /*
   |--------------------------------------------------------------------------
   | DELETE
   |--------------------------------------------------------------------------
   */

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
