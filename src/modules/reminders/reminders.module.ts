import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../../common/mailer/mailer.service';

@Module({
  controllers: [RemindersController],
  providers: [RemindersService, PrismaService, MailerService],
})
export class RemindersModule {}
