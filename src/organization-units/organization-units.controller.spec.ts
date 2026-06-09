import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationUnitsController } from './organization-units.controller';

describe('OrganizationUnitsController', () => {
  let controller: OrganizationUnitsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationUnitsController],
    }).compile();

    controller = module.get<OrganizationUnitsController>(OrganizationUnitsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
