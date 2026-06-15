import { Controller, UseGuards, Get, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getMyNotifications(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getMyNotifications(req.user);
  }
}
