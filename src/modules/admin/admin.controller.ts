import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { UpdateTenantSubscriptionDto } from './dto/update-tenant-subscription.dto';
import { ReviewUpgradeRequestDto } from './dto/review-upgrade-request.dto';
import { ReviewUpgradePaymentDto } from './dto/review-upgrade-payment.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Roles('OWNER')
  @Patch('tenants/:tenantId/subscription')
  updateTenantSubscription(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantSubscriptionDto,
  ) {
    return this.admin.updateTenantSubscription(tenantId, dto);
  }

  @Roles('OWNER')
  @Get('upgrade-requests')
  listUpgradeRequests() {
    return this.admin.listUpgradeRequests();
  }

  @Roles('OWNER')
  @Patch('upgrade-requests/:requestId/review')
  reviewUpgradeRequest(
    @Param('requestId') requestId: string,
    @Body() dto: ReviewUpgradeRequestDto,
  ) {
    return this.admin.reviewUpgradeRequest(requestId, dto);
  }

  @Roles('OWNER')
  @Patch('upgrade-requests/:requestId/payment-review')
  reviewUpgradePayment(
    @Param('requestId') requestId: string,
    @Body() dto: ReviewUpgradePaymentDto,
  ) {
    return this.admin.reviewUpgradePayment(requestId, dto);
  }
}
