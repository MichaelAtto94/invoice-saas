import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ExchangeRatesService } from './exchange-rates.service';
import { SetRateDto } from './dto/set-rate.dto';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly rates: ExchangeRatesService) {}

  @Roles('OWNER', 'ADMIN')
  @Post()
  set(@Body() dto: SetRateDto) {
    return this.rates.setRate(dto);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('latest')
  latest(@Query('from') from: string, @Query('to') to: string) {
    return this.rates.latest(from, to);
  }
}
