import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsModule } from '../sms/sms.module';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [PrismaModule, MailModule, SmsModule],
  providers: [NotificationsService, NotificationsGateway],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
