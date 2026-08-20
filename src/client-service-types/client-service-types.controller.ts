import { Controller, Get } from '@nestjs/common';

import { ClientServiceTypesService } from './client-service-types.service';

@Controller('client-service-types')
export class ClientServiceTypesController {
  constructor(
    private readonly clientServiceTypesService: ClientServiceTypesService,
  ) {}

  @Get()
  findActive() {
    return this.clientServiceTypesService.findActive();
  }
}
