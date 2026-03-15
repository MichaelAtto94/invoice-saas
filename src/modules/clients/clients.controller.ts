import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientsService } from './clients.service';
import { ClientStatementDto } from './dto/client-statement.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

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
  @Get('archived')
  findArchived() {
    return this.clients.findArchived();
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id/dashboard')
  dashboard(@Param('id') id: string) {
    return this.clients.dashboard(id);
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

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id/statement')
  statement(@Param('id') id: string, @Query() query: ClientStatementDto) {
    return this.clients.statement(id, query);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/regenerate-portal-token')
  regeneratePortalToken(@Param('id') id: string) {
    return this.clients.regeneratePortalToken(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.clients.archive(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.clients.restore(id);
  }

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
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clients.findOne(id);
  }
}
