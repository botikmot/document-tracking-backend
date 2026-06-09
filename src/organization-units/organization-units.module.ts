import { Module } from '@nestjs/common';
import { OrganizationUnitsController } from './organization-units.controller';
import { OrganizationUnitsService } from './organization-units.service';

@Module({
  controllers: [OrganizationUnitsController],
  providers: [OrganizationUnitsService],
})
export class OrganizationUnitsModule {}
