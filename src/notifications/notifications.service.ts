import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly notificationsGateway: NotificationsGateway,
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
      const officeUsers = await this.prisma.officeUser.findMany({
        where: {
          officeId: doc.currentOfficeId,
        },

        include: {
          user: true,
        },
      });

      for (const officeUser of officeUsers) {
        const notification = await this.prisma.notification.create({
          data: {
            userId: officeUser.userId,
            title: 'Document Deadline Reminder',
            message: `Document "${doc.title}" is nearing its deadline.`,
            documentId: doc.id,
            type: 'DEADLINE',
          },
        });

        this.notificationsGateway.sendNotification(
          officeUser.userId,
          notification,
        );
      }

      for (const officeUser of officeUsers) {
        if (!officeUser.user.email) continue;

        try {
          const settings = await this.prisma.userSettings.upsert({
            where: {
              userId: officeUser.userId,
            },
            update: {},
            create: {
              userId: officeUser.userId,
            },
          });

          if (settings?.emailNotifications) {
            await this.mailService.sendDeadlineReminder(
              officeUser.user.email,
              doc.title,
              doc.deadline!,
            );
            console.log(`Email sent to ${officeUser.user.email}`);
          }
        } catch (error) {
          console.error(
            `Failed to send email to ${officeUser.user.email}`,
            error,
          );
        }
      }

      /*
   |------------------------------------------------------------
   | EMAIL
   |------------------------------------------------------------
   */
      /* console.log('SENDING EMAIL:', doc.title);
      await this.mailService.sendDeadlineReminder(
        'gonzrock12@gmail.com', //doc.createdBy.email,
        doc.title,
        doc.deadline!,
      ); */

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
        isRead: false,
      },

      orderBy: [
        {
          isRead: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  /*
|--------------------------------------------------------------------------
| MARK AS READ
|--------------------------------------------------------------------------
*/

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: {
        id,
      },

      data: {
        isRead: true,
      },
    });
  }

  /*
|--------------------------------------------------------------------------
| MARK ALL AS READ
|--------------------------------------------------------------------------
*/

  async markAllAsRead(currentUser: AuthenticatedUser) {
    return this.prisma.notification.updateMany({
      where: {
        userId: currentUser.userId,
        isRead: false,
      },

      data: {
        isRead: true,
      },
    });
  }
}
