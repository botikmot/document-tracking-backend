import { Test, TestingModule } from '@nestjs/testing';
import { ClientApplicationsService } from './client-applications.service';

describe('ClientApplicationsService', () => {
  let service: ClientApplicationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientApplicationsService],
    }).compile();

    service = module.get<ClientApplicationsService>(ClientApplicationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
