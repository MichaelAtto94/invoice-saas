import { Controller, Get, Query, Res } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ExportsService } from './exports.service';
import type { Response } from 'express';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsSvc: ExportsService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('invoices.xlsx')
  async invoices(@Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    const { filename, buffer } = await this.exportsSvc.invoicesXlsx(from, to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('receipts.xlsx')
  async receipts(@Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    const { filename, buffer } = await this.exportsSvc.receiptsXlsx(from, to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }
}
