import { Module } from '@nestjs/common';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService],
})
export class ExchangeRatesModule {}
