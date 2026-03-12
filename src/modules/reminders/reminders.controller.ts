import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RemindersService } from './reminders.service';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('history')
  history() {
    return this.reminders.history();
  }
}
