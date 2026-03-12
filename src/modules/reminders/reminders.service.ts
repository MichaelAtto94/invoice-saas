import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../../common/mailer/mailer.service';
import { getRequestContext } from 'src/common/context/request-context';

@Injectable()
export class RemindersService {
  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
  ) {}

  @Cron('0 9 * * *') // every day at 9AM
  async sendOverdueReminders() {
    const today = new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
        dueDate: { lt: today },
      },
      include: {
        client: true,
      },
    });

    let emailsSent = 0;

    for (const inv of invoices) {
      if (!inv.client?.email) continue;

      const balance = (inv.baseTotal ?? 0) - (inv.amountPaid ?? 0);
      if (balance <= 0) continue;

      const subject = `Invoice ${inv.number} is overdue`;

      await this.mailer.sendMail({
        to: inv.client.email,
        subject,
        html: `
          <p>Hello ${inv.client.name},</p>
          <p>Your invoice <b>${inv.number}</b> is overdue.</p>
          <p>Amount Due: <b>${(balance / 100).toFixed(2)} ${inv.currencyCode}</b></p>
          <p>Please arrange payment as soon as possible.</p>
          <p>Thank you.</p>
        `,
        filename: '',
        pdfBuffer: Buffer.from(''),
      });

      await this.prisma.reminderLog.create({
        data: {
          tenantId: inv.tenantId,
          invoiceId: inv.id,
          clientId: inv.client.id,
          email: inv.client.email,
          reminderType: 'OVERDUE',
          subject,
        },
      });

      emailsSent++;
    }

    console.log(`[Reminders] Sent ${emailsSent} overdue reminder emails`);
  }

  async history() {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new Error('Missing tenant context');

    return this.prisma.reminderLog.findMany({
      where: { tenantId },
      orderBy: { sentAt: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            publicId: true,
            total: true,
            amountPaid: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      take: 100,
    });
  }
}
