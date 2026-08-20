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

  async sendClientVerificationEmail(
    to: string,
    firstName: string,
    verificationUrl: string,
  ): Promise<boolean> {
    try {
      await this.mailgun.messages.create(process.env.MAILGUN_DOMAIN || '', {
        from: process.env.MAIL_FROM || '',

        to: [to],

        subject: 'Verify your eDATS Client Portal account',

        text: `
Hello ${firstName},

Thank you for registering with the eDATS Client Portal.

Before you can submit an application, please verify your email address using the link below:

${verificationUrl}

This verification link will expire in 24 hours.

If you did not create this account, you may safely ignore this email.
        `.trim(),

        html: `
          <div
            style="
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              color: #1f2937;
              line-height: 1.6;
            "
          >
            <h2 style="color: #166534;">
              Verify your eDATS Client Portal account
            </h2>

            <p>Hello ${firstName},</p>

            <p>
              Thank you for registering with the
              <strong>eDATS Client Portal</strong>.
            </p>

            <p>
              Before you can submit an application or document request,
              please verify your email address.
            </p>

            <div style="margin: 30px 0;">
              <a
                href="${verificationUrl}"
                style="
                  display: inline-block;
                  background: #166534;
                  color: #ffffff;
                  padding: 12px 22px;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: 600;
                "
              >
                Verify Email Address
              </a>
            </div>

            <p>
              This verification link will expire in
              <strong>24 hours</strong>.
            </p>

            <p style="font-size: 14px; color: #6b7280;">
              If the button does not work, copy and paste this link
              into your browser:
            </p>

            <p
              style="
                font-size: 13px;
                word-break: break-all;
                color: #4b5563;
              "
            >
              ${verificationUrl}
            </p>

            <hr
              style="
                border: 0;
                border-top: 1px solid #e5e7eb;
                margin: 30px 0;
              "
            />

            <p style="font-size: 13px; color: #6b7280;">
              If you did not create this account,
              you may safely ignore this email.
            </p>
          </div>
        `,
      });

      console.log(`Client verification email sent successfully to ${to}`);

      return true;
    } catch (error) {
      console.error('Failed to send client verification email:', error);

      return false;
    }
  }

  async sendClientApplicationAcceptedEmail(
    to: string,
    firstName: string,
    transactionType: string,
    applicationReference: string,
    trackingNumber: string,
  ): Promise<boolean> {
    try {
      await this.mailgun.messages.create(process.env.MAILGUN_DOMAIN || '', {
        from: process.env.MAIL_FROM || '',

        to: [to],

        subject: `Your ${transactionType} Application Has Been Accepted`,

        text: `
Hello ${firstName},

Your ${transactionType} application has been reviewed and accepted.

Application Reference:
${applicationReference}

Official Document Tracking Number:
${trackingNumber}

Please use your official tracking number to monitor the progress of your document.

Thank you.
        `.trim(),

        html: `
          <div
            style="
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              color: #1f2937;
              line-height: 1.6;
            "
          >
            <h2 style="color: #166534;">
              ${transactionType} Application Accepted
            </h2>

            <p>Hello ${firstName},</p>

            <p>
              Your
              <strong>${transactionType}</strong>
              application has been reviewed and accepted.
            </p>

            <div
              style="
                margin: 24px 0;
                padding: 20px;
                background: #f3f4f6;
                border-radius: 8px;
              "
            >
              <p style="margin: 0 0 12px;">
                <strong>Application Reference</strong><br />
                ${applicationReference}
              </p>

              <p style="margin: 0;">
                <strong>Official Document Tracking Number</strong><br />

                <span
                  style="
                    font-size: 20px;
                    font-weight: bold;
                    color: #166534;
                  "
                >
                  ${trackingNumber}
                </span>
              </p>
            </div>

            <p>
              Please use the official tracking number
              to monitor the progress of your document.
            </p>

            <p>Thank you.</p>
          </div>
        `,
      });

      return true;
    } catch (error) {
      console.error('Failed to send application acceptance email:', error);

      return false;
    }
  }

  async sendClientAdditionalRequirementsEmail(
    to: string,
    firstName: string,
    transactionType: string,
    applicationReference: string,
    remarks: string,
  ): Promise<boolean> {
    try {
      await this.mailgun.messages.create(process.env.MAILGUN_DOMAIN || '', {
        from: process.env.MAIL_FROM || '',

        to: [to],

        subject: `Additional Requirements Needed for Your ${transactionType} Application`,

        text: `
Hello ${firstName},

Your ${transactionType} application requires additional information or documents before processing can continue.

Application Reference:
${applicationReference}

Additional Requirements / Remarks:
${remarks}

Please log in to the eDATS Client Portal and upload the requested documents.

After completing the requested requirements, please resubmit your application.

Thank you.
        `.trim(),

        html: `
          <div
            style="
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              color: #1f2937;
              line-height: 1.6;
            "
          >
            <h2 style="color: #b45309;">
              Additional Requirements Needed
            </h2>

            <p>Hello ${firstName},</p>

            <p>
              Your ${transactionType} application requires
              additional information or documents before
              processing can continue.
            </p>

            <div
              style="
                margin: 24px 0;
                padding: 18px;
                background: #f9fafb;
                border-radius: 8px;
              "
            >
              <p>
                <strong>Application Reference</strong><br />
                ${applicationReference}
              </p>

              <p style="margin-bottom: 0;">
                <strong>Requested Requirements / Remarks</strong><br />
                ${remarks}
              </p>
            </div>

            <p>
              Please log in to the
              <strong>eDATS Client Portal</strong>,
              upload the requested document(s), and
              resubmit your application.
            </p>

            <p>Thank you.</p>
          </div>
        `,
      });

      console.log(`Additional requirements email sent to ${to}`);

      return true;
    } catch (error) {
      console.error('Failed to send additional requirements email:', error);

      return false;
    }
  }

  async sendClientApplicationRejectedEmail(
    to: string,
    firstName: string,
    transactionType: string,
    applicationReference: string,
    reason: string,
  ): Promise<boolean> {
    try {
      await this.mailgun.messages.create(process.env.MAILGUN_DOMAIN || '', {
        from: process.env.MAIL_FROM || '',

        to: [to],

        subject: `Update on Your ${transactionType} Application`,

        text: `
Hello ${firstName},

Your ${transactionType} application has been reviewed and was not accepted.

Application Reference:
${applicationReference}

Reason / Remarks:
${reason}

You may log in to the eDATS Client Portal to review the application details.

Thank you.
        `.trim(),

        html: `
          <div
            style="
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              color: #1f2937;
              line-height: 1.6;
            "
          >
            <h2 style="color: #b91c1c;">
              Application Update
            </h2>

            <p>Hello ${firstName},</p>

            <p>
              Your ${transactionType} application
              has been reviewed and was
              <strong>not accepted</strong>.
            </p>

            <div
              style="
                margin: 24px 0;
                padding: 18px;
                background: #f9fafb;
                border-radius: 8px;
              "
            >
              <p>
                <strong>Application Reference</strong><br />
                ${applicationReference}
              </p>

              <p style="margin-bottom: 0;">
                <strong>Reason / Remarks</strong><br />
                ${reason}
              </p>
            </div>

            <p>
              You may log in to the
              <strong>eDATS Client Portal</strong>
              to review your application details.
            </p>

            <p>Thank you.</p>
          </div>
        `,
      });

      console.log(`Application rejection email sent to ${to}`);

      return true;
    } catch (error) {
      console.error('Failed to send application rejection email:', error);

      return false;
    }
  }
}
