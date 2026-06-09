import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationUnitsService } from './organization-units.service';

describe('OrganizationUnitsService', () => {
  let service: OrganizationUnitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationUnitsService],
    }).compile();

    service = module.get<OrganizationUnitsService>(OrganizationUnitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
