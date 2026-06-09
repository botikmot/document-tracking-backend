import { PartialType } from '@nestjs/swagger';

import { CreateOrganizationUnitDto } from './create-organization-unit.dto';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export class UpdateOrganizationUnitDto extends PartialType(
  CreateOrganizationUnitDto,
) {}
