import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConvertQuoteDto } from './dto/convert-quote.dto';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.quotes.create(dto);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get()
  list() {
    return this.quotes.list();
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.quotes.getById(id);
  }

  // ✅ Convert Quote → Invoice
  @Roles('OWNER', 'ADMIN')
  @Post(':id/convert')
  convert(@Param('id') id: string, @Body() dto: ConvertQuoteDto) {
    return this.quotes.convertToInvoice(id, dto);
  }
}
