import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { StartPaymentDto } from './dto/start-payment.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { ReviewPaymentDto } from './dto/review-payment.dto';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('public/payments/start')
  start(@Body() dto: StartPaymentDto) {
    return this.payments.startPublicPayment(dto);
  }

  @Post('public/payments/:id/submit-proof')
  submitProof(@Param('id') id: string, @Body() dto: SubmitPaymentProofDto) {
    return this.payments.submitProof(id, dto);
  }

  @Get('public/payments/:id')
  getPublicPayment(@Param('id') id: string) {
    return this.payments.getPublicPayment(id);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('payments/pending')
  listPending() {
    return this.payments.listPending();
  }

  @Roles('OWNER', 'ADMIN')
  @Post('payments/:id/approve')
  approve(@Param('id') id: string, @Body() dto: ReviewPaymentDto) {
    return this.payments.approvePayment(id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('payments/:id/reject')
  reject(@Param('id') id: string, @Body() dto: ReviewPaymentDto) {
    return this.payments.rejectPayment(id, dto);
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('payments/stats')
  stats() {
    return this.payments.stats();
  }
}
