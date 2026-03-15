import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ItemsModule } from './modules/items/items.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';

import { RolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MailerService } from './common/mailer/mailer.service';
import { ExportsModule } from './modules/exports/exports.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { RecurringInvoicesModule } from './modules/recurring-invoices/recurring-invoices.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RemindersModule } from './modules/reminders/reminders.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { PublicInvoicesModule } from './modules/public-invoices/public-invoices.module';
import { AuditModule } from './modules/audit/audit.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SearchModule } from './modules/search/search.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ClientPortalModule } from './modules/client-portal/client-portal.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 60,
        },
      ],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    ClientsModule,
    ItemsModule,
    QuotesModule,
    InvoicesModule,
    ReceiptsModule,
    DashboardModule,
    ExportsModule,
    ExchangeRatesModule,
    RecurringInvoicesModule,
    RemindersModule,
    TenantModule,
    PublicInvoicesModule,
    PaymentsModule,
    AuditModule,
    SearchModule,
    NotificationsModule,
    UploadsModule,
    ClientPortalModule,
    AdminModule,
    HealthModule,
    
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    MailerService,
  ],
})
export class AppModule {}
