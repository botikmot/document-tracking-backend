import { Test, TestingModule } from '@nestjs/testing';
import { ClientServiceTypesService } from './client-service-types.service';

describe('ClientServiceTypesService', () => {
  let service: ClientServiceTypesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientServiceTypesService],
    }).compile();

    service = module.get<ClientServiceTypesService>(ClientServiceTypesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
