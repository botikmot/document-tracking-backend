import { Injectable } from '@nestjs/common';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

type MailgunClient = ReturnType<InstanceType<typeof Mailgun>['client']>;

@Injectable()
export class MailService {
  private readonly mailgun: MailgunClient;

  constructor() {
    const mailgun = new Mailgun(formData);

    this.mailgun = mailgun.client({
      username: 'api',

      key: process.env.MAILGUN_API_KEY || '',
    });
  }

  /*
   |------------------------------------------------------------
   | SEND EMAIL
   |------------------------------------------------------------
   */

  async sendDeadlineReminder(
    to: string,
    documentTitle: string,
    deadline: Date,
  ): Promise<void> {
    try {
      await this.mailgun.messages.create(
        process.env.MAILGUN_DOMAIN || '',

        {
          from: process.env.MAIL_FROM || '',

          to: [to],

          subject: 'Document Deadline Reminder',

          text: `
Document "${documentTitle}" is nearing its deadline.

Deadline:
${deadline.toLocaleString()}
          `,
        },
      );

      console.log('Email sent successfully');
    } catch (error) {
      console.error(error);
    }
  }
}
