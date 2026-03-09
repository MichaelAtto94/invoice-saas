import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Query } from '@nestjs/common';
import { ClientStatementDto } from './dto/client-statement.dto';
import { Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  // OWNER/ADMIN/STAFF can create clients
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clients.create(dto);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get()
  findAll() {
    return this.clients.findAll();
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clients.findOne(id);
  }

  // Restrict update/delete to OWNER/ADMIN
  @Roles('OWNER', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clients.remove(id);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id/statement')
  statement(@Param('id') id: string, @Query() query: ClientStatementDto) {
    return this.clients.statement(id, query);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id/statement/pdf')
  async statementPdf(
    @Param('id') id: string,
    @Query() query: ClientStatementDto,
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.clients.statementPdf(id, query);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.end(buffer);
  }
}
