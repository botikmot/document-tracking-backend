import { Injectable } from '@nestjs/common';

import Twilio from 'twilio';

@Injectable()
export class SmsService {
  private client: Twilio.Twilio;

  constructor() {
    this.client = Twilio(
      process.env.TWILIO_ACCOUNT_SID || '',

      process.env.TWILIO_AUTH_TOKEN || '',
    );
  }

  /*
   |------------------------------------------------------------
   | SEND SMS
   |------------------------------------------------------------
   */

  async sendDeadlineReminder(
    to: string,
    documentTitle: string,
    deadline: Date,
  ) {
    try {
      await this.client.messages.create({
        body: `
Document "${documentTitle}" is nearing its deadline.

Deadline:
${deadline.toLocaleString()}
        `,

        from: process.env.TWILIO_PHONE_NUMBER,

        to,
      });

      console.log('SMS sent successfully');
    } catch (error) {
      console.error('TWILIO SMS ERROR:', error);
    }
  }
}

/* import { Injectable } from '@nestjs/common';

import axios from 'axios';

@Injectable()
export class SmsService {
  
  async sendDeadlineReminder(number: string, documentTitle: string) {
    try {
      await axios.post(
        'https://api.semaphore.co/api/v4/messages',

        {
          apikey: process.env.SEMAPHORE_API_KEY,
          number,
          message: `Reminder: "${documentTitle}" is nearing its deadline.`,
        },
      );

      console.log('SMS sent');
    } catch (error) {
      console.error(error);
    }
  }
} */
