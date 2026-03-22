import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { PrismaService } from '../../database/prisma.service';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [MailerModule], // ✅ THIS is the fix
  controllers: [RemindersController],
  providers: [RemindersService, PrismaService],
})
export class RemindersModule {}
