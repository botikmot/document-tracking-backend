import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
  ) {}

  /*
   |-------------------------------------------------------------
   | CHECK DEADLINES
   |-------------------------------------------------------------
   */

  @Cron('0 * * * *') // every hour
  async checkDeadlines() {
    const now = new Date();
    console.log('CRON RUNNING...');

    /*
     |-----------------------------------------------------------
     | Next 24 hours
     |-----------------------------------------------------------
     */

    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    /*
     |-----------------------------------------------------------
     | Find documents nearing deadline
     |-----------------------------------------------------------
     */

    const documents = await this.prisma.document.findMany({
      where: {
        deadline: {
          lte: next24Hours,
          gte: now,
        },

        currentStatus: {
          name: {
            notIn: ['COMPLETED', 'ARCHIVED'],
          },
        },
        deadlineReminderSent: false,
      },

      include: {
        createdBy: true,
        currentOffice: true,
      },
    });

    /*
     |-----------------------------------------------------------
     | Create notifications
     |-----------------------------------------------------------
     */
    console.log('FOUND DOCS:', documents.length);

    for (const doc of documents) {
      console.log('SENDING EMAIL:', doc.title);
      await this.prisma.notification.create({
        data: {
          userId: doc.createdById,
          title: 'Document Deadline Reminder',
          message: `Document "${doc.title}" is nearing its deadline.`,
          type: 'SYSTEM',
        },
      });

      /*
   |------------------------------------------------------------
   | EMAIL
   |------------------------------------------------------------
   */

      await this.mailService.sendDeadlineReminder(
        'gonzrock12@gmail.com', //doc.createdBy.email,
        doc.title,
        doc.deadline!,
      );

      /*
   |------------------------------------------------------------
   | SMS
   |------------------------------------------------------------
   */

      //if (doc.createdBy.mobileNumber) {
      /* await this.smsService.sendDeadlineReminder(
        '+639949358579', //doc.createdBy.mobileNumber,
        doc.title,
        doc.deadline!,
      ); */
      //}

      console.log(`Reminder sent for ${doc.trackingNumber}`);

      await this.prisma.document.update({
        where: {
          id: doc.id,
        },

        data: {
          deadlineReminderSent: true,
        },
      });
    }
  }

  getMyNotifications(currentUser: AuthenticatedUser) {
    return this.prisma.notification.findMany({
      where: {
        userId: currentUser.userId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
