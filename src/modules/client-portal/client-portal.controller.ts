import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ClientPortalService } from './client-portal.service';

@Controller('public/client-portal')
export class ClientPortalController {
  constructor(private readonly portal: ClientPortalService) {}

  @Get(':token')
  getPortal(@Param('token') token: string) {
    return this.portal.getByToken(token);
  }

  @Get(':token/statement.pdf')
  async getStatementPdf(@Param('token') token: string, @Res() res: Response) {
    const { filename, buffer } =
      await this.portal.getStatementPdfByToken(token);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.end(buffer);
  }
}
