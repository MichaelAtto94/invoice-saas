import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserType } from '../../common/types/current-user.type';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserRoleDto } from './dto/update-tenant-user-role.dto';
import { SetUserActiveStatusDto } from './dto/set-user-active-status.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('OWNER', 'ADMIN')
  findTenantUsers(@CurrentUser() user: CurrentUserType) {
    return this.usersService.findTenantUsers(user);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  createTenantUser(
    @Body() dto: CreateTenantUserDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.usersService.createTenantUser(dto, user);
  }

  @Patch('role')
  @Roles('OWNER', 'ADMIN')
  updateTenantUserRole(
    @Body() dto: UpdateTenantUserRoleDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.usersService.updateTenantUserRole(dto, user);
  }

  @Patch('active-status')
  @Roles('OWNER', 'ADMIN')
  setUserActiveStatus(
    @Body() dto: SetUserActiveStatusDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.usersService.setUserActiveStatus(dto, user);
  }
}
