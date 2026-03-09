import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import type { Response } from 'express';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get()
  list() {
    return this.receipts.list();
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.receipts.getById(id);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post()
  create(@Body() dto: CreateReceiptDto) {
    return this.receipts.create(dto);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const { filename, buffer } = await this.receipts.buildReceiptPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.end(buffer);
  }
}
