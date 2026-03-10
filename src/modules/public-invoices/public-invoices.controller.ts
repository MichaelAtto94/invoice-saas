import { Controller, Get, Param } from '@nestjs/common';
import { PublicInvoicesService } from './public-invoices.service';

@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly service: PublicInvoicesService) {}

  @Get(':publicId')
  getInvoice(@Param('publicId') publicId: string) {
    return this.service.findByPublicId(publicId);
  }
}
