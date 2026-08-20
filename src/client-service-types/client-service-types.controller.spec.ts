import { Test, TestingModule } from '@nestjs/testing';
import { ClientServiceTypesController } from './client-service-types.controller';

describe('ClientServiceTypesController', () => {
  let controller: ClientServiceTypesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientServiceTypesController],
    }).compile();

    controller = module.get<ClientServiceTypesController>(ClientServiceTypesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
