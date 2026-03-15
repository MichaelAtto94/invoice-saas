import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post()
  create(@Body() dto: CreateItemDto) {
    return this.items.create(dto);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get()
  findAll() {
    return this.items.findAll();
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('archived')
  findArchived() {
    return this.items.findArchived();
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.items.findOne(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.items.update(id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.items.remove(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.items.archive(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.items.restore(id);
  }
}
