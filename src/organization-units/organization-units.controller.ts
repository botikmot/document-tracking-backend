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
import { OrganizationUnitsService } from './organization-units.service';
import { CreateOrganizationUnitDto } from './dto/create-organization-unit.dto';
import { UpdateOrganizationUnitDto } from './dto/update-organization-unit.dto';

@Controller('organization-units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationUnitsController {
  constructor(
    private readonly organizationUnitsService: OrganizationUnitsService,
  ) {}

  /*
   |--------------------------------------------------------------------------
   | CREATE
   |--------------------------------------------------------------------------
   */

  @Post()
  @Roles('SUPER_ADMIN')
  create(
    @Body()
    dto: CreateOrganizationUnitDto,
  ) {
    return this.organizationUnitsService.create(dto);
  }

  /*
   |--------------------------------------------------------------------------
   | LIST
   |--------------------------------------------------------------------------
   */

  @Get()
  findAll() {
    return this.organizationUnitsService.findAll();
  }

  /*
   |--------------------------------------------------------------------------
   | TREE
   |--------------------------------------------------------------------------
   */

  @Get('tree')
  getTree() {
    return this.organizationUnitsService.getTree();
  }

  /*
   |--------------------------------------------------------------------------
   | FIND ONE
   |--------------------------------------------------------------------------
   */

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationUnitsService.findOne(id);
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

    @Body()
    dto: UpdateOrganizationUnitDto,
  ) {
    return this.organizationUnitsService.update(id, dto);
  }

  /*
   |--------------------------------------------------------------------------
   | DELETE
   |--------------------------------------------------------------------------
   */

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.organizationUnitsService.remove(id);
  }
}
