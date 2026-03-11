import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { StartPaymentDto } from './dto/start-payment.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { ReviewPaymentDto } from './dto/review-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async startPublicPayment(dto: StartPaymentDto) {
    if (!dto.invoicePublicId) {
      throw new BadRequestException('invoicePublicId is required');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { publicId: dto.invoicePublicId },
      include: { client: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    const balance = Math.max(
      0,
      (invoice.total ?? 0) - (invoice.amountPaid ?? 0),
    );
    if (balance <= 0) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('amount must be greater than 0');
    }

    if (dto.amount > balance) {
      throw new BadRequestException('amount cannot exceed invoice balance');
    }

    const attempt = await this.prisma.paymentAttempt.create({
      data: {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        channel: dto.channel as any,
        amount: dto.amount,
        payerName: dto.payerName?.trim() || null,
        payerPhone: dto.payerPhone?.trim() || null,
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        amount: true,
        channel: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            number: true,
            publicId: true,
            total: true,
            amountPaid: true,
            currencyCode: true,
          },
        },
      },
    });

    return attempt;
  }

  async submitProof(paymentAttemptId: string, dto?: SubmitPaymentProofDto) {
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { id: paymentAttemptId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!attempt) throw new NotFoundException('Payment attempt not found');

    if (attempt.status === 'APPROVED') {
      throw new BadRequestException('Payment attempt already approved');
    }

    const safeDto = dto ?? {};

    return this.prisma.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: {
        reference: safeDto.reference?.trim() || null,
        notes: safeDto.notes?.trim() || null,
        proofUrl: safeDto.proofUrl?.trim() || null,
        status: 'SUBMITTED',
      },
      select: {
        id: true,
        status: true,
        amount: true,
        channel: true,
        reference: true,
        notes: true,
        proofUrl: true,
        createdAt: true,
      },
    });
  }

  async getPublicPayment(paymentAttemptId: string) {
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { id: paymentAttemptId },
      select: {
        id: true,
        status: true,
        amount: true,
        channel: true,
        payerName: true,
        payerPhone: true,
        reference: true,
        notes: true,
        proofUrl: true,
        createdAt: true,
        invoice: {
          select: {
            number: true,
            publicId: true,
            currencyCode: true,
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException('Payment attempt not found');
    return attempt;
  }

  async approvePayment(id: string, dto: ReviewPaymentDto) {
    const tenantId = this.requireTenantId();

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { id, tenantId },
      include: {
        invoice: true,
      },
    });

    if (!attempt) throw new NotFoundException('Payment attempt not found');

    if (attempt.status === 'APPROVED') {
      throw new BadRequestException('Payment attempt already approved');
    }

    if (attempt.status === 'REJECTED') {
      throw new BadRequestException(
        'Rejected payment attempt cannot be approved',
      );
    }

    const reviewerId = getRequestContext()?.userId ?? null;

    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
        select: { receiptNext: true },
      });

      const receiptNumber = `REC-${String(seq.receiptNext).padStart(5, '0')}`;

      await tx.documentSequence.update({
        where: { tenantId },
        data: { receiptNext: seq.receiptNext + 1 },
      });

      const receipt = await tx.receipt.create({
        data: {
          tenantId,
          invoiceId: attempt.invoiceId,
          number: receiptNumber,
          amount: attempt.amount,
          method:
            attempt.channel === 'BANK_TRANSFER'
              ? 'BANK_TRANSFER'
              : attempt.channel === 'MOBILE_MONEY'
                ? 'MOBILE_MONEY'
                : attempt.channel === 'CASH'
                  ? 'CASH'
                  : 'OTHER',
          reference: attempt.reference,
          notes: dto.notes?.trim() || attempt.notes || null,
          //receivedAt: new Date(),
        },
      });

      const newAmountPaid = (attempt.invoice.amountPaid ?? 0) + attempt.amount;
      const invoiceTotal = attempt.invoice.total ?? 0;

      let newStatus: 'PARTIALLY_PAID' | 'PAID' = 'PARTIALLY_PAID';
      if (newAmountPaid >= invoiceTotal) {
        newStatus = 'PAID';
      }

      await tx.invoice.update({
        where: { id: attempt.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      const updatedAttempt = await tx.paymentAttempt.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          createdReceiptId: receipt.id,
          notes: dto.notes?.trim() || attempt.notes || null,
        },
        select: {
          id: true,
          status: true,
          amount: true,
          channel: true,
          reference: true,
          notes: true,
          reviewedAt: true,
          createdReceiptId: true,
        },
      });

      return {
        ok: true,
        paymentAttempt: updatedAttempt,
        receipt: {
          id: receipt.id,
          number: receipt.number,
          amount: receipt.amount,
        },
      };
    });
  }

  async rejectPayment(id: string, dto: ReviewPaymentDto) {
    const tenantId = this.requireTenantId();

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!attempt) throw new NotFoundException('Payment attempt not found');

    if (attempt.status === 'APPROVED') {
      throw new BadRequestException(
        'Approved payment attempt cannot be rejected',
      );
    }

    return this.prisma.paymentAttempt.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        notes: dto.notes?.trim() || undefined,
      },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        notes: true,
      },
    });
  }

  async listPending() {
    const tenantId = this.requireTenantId();

    return this.prisma.paymentAttempt.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'SUBMITTED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            publicId: true,
            total: true,
            amountPaid: true,
            currencyCode: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  async stats() {
    const tenantId = this.requireTenantId();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const attempts = await this.prisma.paymentAttempt.findMany({
      where: { tenantId },
      select: {
        status: true,
        channel: true,
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totals = {
      pending: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      amountPending: 0,
      amountApproved: 0,
      amountRejected: 0,
    };

    const byChannelMap: Record<
      string,
      { channel: string; count: number; amount: number }
    > = {};

    let thisMonthAttempts = 0;
    let thisMonthApprovedAmount = 0;

    for (const a of attempts) {
      if (a.status === 'PENDING') {
        totals.pending += 1;
        totals.amountPending += a.amount ?? 0;
      }

      if (a.status === 'SUBMITTED') {
        totals.submitted += 1;
        totals.amountPending += a.amount ?? 0;
      }

      if (a.status === 'APPROVED') {
        totals.approved += 1;
        totals.amountApproved += a.amount ?? 0;
      }

      if (a.status === 'REJECTED') {
        totals.rejected += 1;
        totals.amountRejected += a.amount ?? 0;
      }

      const key = a.channel;
      if (!byChannelMap[key]) {
        byChannelMap[key] = {
          channel: key,
          count: 0,
          amount: 0,
        };
      }

      byChannelMap[key].count += 1;
      byChannelMap[key].amount += a.amount ?? 0;

      if (a.createdAt >= monthStart) {
        thisMonthAttempts += 1;
        if (a.status === 'APPROVED') {
          thisMonthApprovedAmount += a.amount ?? 0;
        }
      }
    }

    const byChannel = Object.values(byChannelMap).sort(
      (a, b) => b.amount - a.amount,
    );

    return {
      totals,
      byChannel,
      thisMonth: {
        attempts: thisMonthAttempts,
        approvedAmount: thisMonthApprovedAmount,
      },
    };
  }
}
