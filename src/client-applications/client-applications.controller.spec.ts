import { Test, TestingModule } from '@nestjs/testing';
import { ClientApplicationsController } from './client-applications.controller';

describe('ClientApplicationsController', () => {
  let controller: ClientApplicationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientApplicationsController],
    }).compile();

    controller = module.get<ClientApplicationsController>(ClientApplicationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
