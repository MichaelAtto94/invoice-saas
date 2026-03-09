import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../../common/mailer/mailer.service';

@Module({
  providers: [RemindersService, PrismaService, MailerService],
})
export class RemindersModule {}
