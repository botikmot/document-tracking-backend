import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OfficesService } from './offices.service';
import { CreateOfficeDto } from './dto/create-office.dto';
import { UpdateOfficeDto } from './dto/update-office.dto';
import { AssignUserOfficeDto } from './dto/assign-user-office.dto';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

@Controller('offices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OfficesController {
  constructor(private readonly officesService: OfficesService) {}

  /*
   |--------------------------------------------------------------------------
   | CREATE OFFICE
   |--------------------------------------------------------------------------
   */

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateOfficeDto) {
    return this.officesService.create(dto);
  }

  /*
   |--------------------------------------------------------------------------
   | LIST OFFICES
   |--------------------------------------------------------------------------
   */

  @Get()
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  findAll() {
    return this.officesService.findAll();
  }

  /*
   |--------------------------------------------------------------------------
   | ACCESSIBLE OFFICES BASED ON USER ORGANIZATION
   |--------------------------------------------------------------------------
   */
  @Get('accessible')
  getAccessibleOffices(@Req() req: AuthenticatedRequest) {
    return this.officesService.getAccessibleOffices(req.user);
  }

  /*
   |--------------------------------------------------------------------------
   | FIND OFFICE
   |--------------------------------------------------------------------------
   */

  @Get(':id')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  findOne(@Param('id') id: string) {
    return this.officesService.findOne(id);
  }

  /*
   |--------------------------------------------------------------------------
   | UPDATE OFFICE
   |--------------------------------------------------------------------------
   */

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  update(
    @Param('id') id: string,

    @Body() dto: UpdateOfficeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.officesService.update(id, dto, req.user);
  }

  /*
   |--------------------------------------------------------------------------
   | DELETE OFFICE
   |--------------------------------------------------------------------------
   */

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.officesService.remove(id);
  }

  /*
   |--------------------------------------------------------------------------
   | ASSIGN USER TO OFFICE
   |--------------------------------------------------------------------------
   */

  @Post(':id/users')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  assignUser(
    @Param('id') officeId: string,

    @Body()
    dto: AssignUserOfficeDto,
  ) {
    return this.officesService.assignUser(officeId, dto);
  }
}
