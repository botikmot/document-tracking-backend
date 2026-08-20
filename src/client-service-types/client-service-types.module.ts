import { Module } from '@nestjs/common';

import { ClientServiceTypesController } from './client-service-types.controller';
import { ClientServiceTypesService } from './client-service-types.service';

@Module({
  controllers: [ClientServiceTypesController],

  providers: [ClientServiceTypesService],

  exports: [ClientServiceTypesService],
})
export class ClientServiceTypesModule {}
