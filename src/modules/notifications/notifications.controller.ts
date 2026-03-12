import { Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get()
  list() {
    return this.notifications.list();
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('unread-count')
  unreadCount() {
    return this.notifications.unreadCount();
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('read-all')
  markAllRead() {
    return this.notifications.markAllRead();
  }
}
