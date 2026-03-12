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

@Module({
  imports: [
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    MailerService,
  ],
})
export class AppModule {}
