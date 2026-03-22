import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../../modules/mailer/mailer.service';
import { getRequestContext } from 'src/common/context/request-context';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  @Cron('0 9 * * *')
  async sendOverdueReminders() {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

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

      const balance = (inv.total ?? 0) - (inv.amountPaid ?? 0);
      if (balance <= 0) continue;

      const alreadySentToday = await this.prisma.reminderLog.findFirst({
        where: {
          tenantId: inv.tenantId,
          invoiceId: inv.id,
          reminderType: 'OVERDUE',
          sentAt: { gte: startOfToday },
        },
        select: { id: true },
      });

      if (alreadySentToday) continue;

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
        filename: 'notice.pdf',
        pdfBuffer: Buffer.from('Reminder notice'),
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
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');

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
