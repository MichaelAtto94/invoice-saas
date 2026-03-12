import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get()
  search(@Query('q') q: string) {
    return this.searchService.search(q);
  }
}
