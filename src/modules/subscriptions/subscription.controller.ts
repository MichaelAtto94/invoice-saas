import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { RequestUpgradeDto } from './dto/request-upgrade.dto';
import { SubmitUpgradePaymentDto } from './dto/submit-upgrade-payment.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('me')
  me() {
    return this.subscriptions.getCurrentPlan();
  }

  @Roles('OWNER')
  @Patch('me')
  updateMySubscription(@Body() dto: UpdateSubscriptionDto) {
    return this.subscriptions.updateMySubscription(dto);
  }

  @Roles('OWNER')
  @Post('upgrade-request')
  requestUpgrade(@Body() dto: RequestUpgradeDto) {
    return this.subscriptions.requestUpgrade(dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Get('upgrade-requests')
  listMyUpgradeRequests() {
    return this.subscriptions.listMyUpgradeRequests();
  }

  @Roles('OWNER')
  @Post('upgrade-requests/:requestId/payment')
  submitUpgradePayment(
    @Param('requestId') requestId: string,
    @Body() dto: SubmitUpgradePaymentDto,
  ) {
    return this.subscriptions.submitUpgradePayment(requestId, dto);
  }
}
