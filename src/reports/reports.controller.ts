import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { ReportsService } from './reports.service';
import { ReportFilterDto } from './dto/report-filter.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async generateReport(@Query() filter: ReportFilterDto) {
    return this.reportsService.generateReport(filter);
  }
}
