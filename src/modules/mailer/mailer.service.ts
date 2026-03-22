import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async sendMail(params: {
    to: string;
    subject: string;
    html: string;
    filename: string;
    pdfBuffer: Buffer;
  }) {
    const from =
      process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';

    return this.transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: [
        {
          filename: params.filename,
          content: params.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}
