import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './pdf/invoice-pdf.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserType } from '../../common/types/current-user.type';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'STAFF')
  findAll(@CurrentUser() user: CurrentUserType) {
    return this.invoicesService.findAll(user.tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'STAFF')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.invoicesService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'STAFF')
  create(@Body() dto: any, @CurrentUser() user: CurrentUserType) {
    return this.invoicesService.create(dto, user);
  }

  @Patch(':id/send')
  @Roles('OWNER', 'ADMIN')
  send(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.invoicesService.send(id, user);
  }

  @Get(':id/pdf')
  @Roles('OWNER', 'ADMIN', 'STAFF')
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(
      id,
      user.tenantId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
