import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('me')
  getMySettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getMySettings(req.user.userId);
  }

  @Patch()
  updateMySettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateMySettings(req.user.userId, dto);
  }
}
