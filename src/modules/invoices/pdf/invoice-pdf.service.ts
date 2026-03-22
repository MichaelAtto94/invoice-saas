import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../../database/prisma.service';
import fs from 'fs';
import path from 'path';

function formatMoney(amount: number, currency = 'ZMW') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format((amount ?? 0) / 100);
}

function safeImage(
  doc: PDFKit.PDFDocument,
  filePath: string,
  x: number,
  y: number,
  options: Record<string, any>,
) {
  try {
    if (fs.existsSync(filePath)) {
      doc.image(filePath, x, y, options);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

@Injectable()
export class InvoicePdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInvoicePdf(
    invoiceId: string,
    tenantId: string,
  ): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        client: true,
        lines: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const left = 50;
      const right = doc.page.width - 50;
      const pageHeight = doc.page.height;

      const logoPath = path.join(process.cwd(), 'src/assets/logo.png');
      const signaturePath = path.join(
        process.cwd(),
        'src/assets/signature.png',
      );
      const stampPath = path.join(process.cwd(), 'src/assets/stamp.png');

      const hasLogo = safeImage(doc, logoPath, left, 40, { width: 70 });
      const companyTextX = hasLogo ? 135 : left;

      // Header
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('Cloud Motion Ltd', companyTextX, 45);

      doc
        .font('Helvetica')
        .fontSize(10)
        .text('Lusaka, Zambia', companyTextX, 72)
        .text('Phone: +260 XXX XXX XXX', companyTextX, 86)
        .text('Email: info@cloudmotion.com', companyTextX, 100);

      doc
        .font('Helvetica-Bold')
        .fontSize(24)
        .text('INVOICE', 0, 50, { align: 'right' });

      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`Invoice #: ${invoice.number}`, 0, 86, { align: 'right' })
        .text(`Status: ${invoice.status}`, 0, 100, { align: 'right' })
        .text(
          `Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}`,
          0,
          114,
          { align: 'right' },
        )
        .text(
          `Due Date: ${
            invoice.dueDate
              ? new Date(invoice.dueDate).toLocaleDateString()
              : 'N/A'
          }`,
          0,
          128,
          { align: 'right' },
        );

      doc.moveTo(left, 155).lineTo(right, 155).stroke();

      // Bill to
      doc.font('Helvetica-Bold').fontSize(12).text('Bill To', left, 175);

      doc
        .font('Helvetica')
        .fontSize(11)
        .text(invoice.client.name, left, 195)
        .text(invoice.client.email || 'N/A', left, 212)
        .text(invoice.client.phone || 'N/A', left, 229)
        .text(invoice.client.address || 'N/A', left, 246);

      // Items table
      const tableTop = 290;

      doc
        .rect(left, tableTop, right - left, 22)
        .fillAndStroke('#f3f4f6', '#d1d5db');

      doc.fillColor('black');
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Item', left + 8, tableTop + 6);
      doc.text('Qty', 300, tableTop + 6);
      doc.text('Unit Price', 350, tableTop + 6);
      doc.text('Total', 470, tableTop + 6);

      let y = tableTop + 30;
      doc.font('Helvetica').fontSize(10);

      for (const line of invoice.lines) {
        doc.text(line.name, left + 8, y, { width: 220 });
        doc.text(String(line.quantity), 300, y);
        doc.text(formatMoney(line.unitPrice, invoice.currencyCode), 350, y);
        doc.text(formatMoney(line.lineTotal, invoice.currencyCode), 470, y);

        if (line.description) {
          doc
            .fontSize(9)
            .fillColor('#555')
            .text(line.description, left + 16, y + 13, { width: 220 })
            .fillColor('black')
            .fontSize(10);
          y += 34;
        } else {
          y += 22;
        }

        doc
          .moveTo(left, y - 4)
          .lineTo(right, y - 4)
          .strokeColor('#e5e7eb')
          .stroke();
        doc.strokeColor('black');
      }

      // Totals
      const totalsY = y + 20;
      const balance = invoice.total - invoice.amountPaid;

      doc.font('Helvetica').fontSize(11);
      doc.text('Subtotal:', 360, totalsY);
      doc.text(
        formatMoney(invoice.subtotal, invoice.currencyCode),
        460,
        totalsY,
        {
          width: 90,
          align: 'right',
        },
      );

      doc.text('Tax:', 360, totalsY + 20);
      doc.text(
        formatMoney(invoice.taxTotal, invoice.currencyCode),
        460,
        totalsY + 20,
        {
          width: 90,
          align: 'right',
        },
      );

      doc.font('Helvetica-Bold').fontSize(13);
      doc.text('Total:', 360, totalsY + 45);
      doc.text(
        formatMoney(invoice.total, invoice.currencyCode),
        460,
        totalsY + 45,
        {
          width: 90,
          align: 'right',
        },
      );

      doc.font('Helvetica').fontSize(11);
      doc.text('Paid:', 360, totalsY + 70);
      doc.text(
        formatMoney(invoice.amountPaid, invoice.currencyCode),
        460,
        totalsY + 70,
        {
          width: 90,
          align: 'right',
        },
      );

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Balance:', 360, totalsY + 95);
      doc.text(formatMoney(balance, invoice.currencyCode), 460, totalsY + 95, {
        width: 90,
        align: 'right',
      });

      // Payment details
      const paymentBoxY = totalsY + 145;

      doc
        .rect(left, paymentBoxY, right - left, 95)
        .strokeColor('#d1d5db')
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('black')
        .text('Payment Details', left + 10, paymentBoxY + 10);

      doc
        .font('Helvetica')
        .fontSize(10)
        .text('Bank Name: Zanaco Bank', left + 10, paymentBoxY + 30)
        .text('Account Name: Cloud Motion Ltd', left + 10, paymentBoxY + 45)
        .text('Account Number: 1234567890', left + 10, paymentBoxY + 60)
        .text('Branch: Cairo Road', left + 10, paymentBoxY + 75);

      doc
        .text('Mobile Money:', 320, paymentBoxY + 30)
        .text('Airtel Money: 0970 000 000', 320, paymentBoxY + 45)
        .text('MTN MoMo: 0960 000 000', 320, paymentBoxY + 60)
        .text('Name: Cloud Motion Ltd', 320, paymentBoxY + 75);

      // Signatures
      const signatureY = paymentBoxY + 125;

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Authorized Signature', left, signatureY);

      safeImage(doc, signaturePath, left, signatureY + 2, { width: 120 });
      safeImage(doc, stampPath, left + 130, signatureY - 2, { width: 60 });

      doc
        .moveTo(left, signatureY + 35)
        .lineTo(left + 180, signatureY + 35)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(9)
        .text('For Cloud Motion Ltd', left, signatureY + 42);

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Client Acknowledgement', 330, signatureY);

      doc
        .moveTo(330, signatureY + 35)
        .lineTo(510, signatureY + 35)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(9)
        .text('Signature / Stamp', 330, signatureY + 42);

      // Footer
      const footerY = pageHeight - 60;

      doc
        .moveTo(left, footerY - 10)
        .lineTo(right, footerY - 10)
        .strokeColor('#d1d5db')
        .stroke();
      doc.strokeColor('black');

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('black')
        .text('Thank you for your business.', left, footerY)
        .text(
          `Generated on ${new Date().toLocaleDateString()}`,
          left,
          footerY + 14,
        );

      doc
        .text('Cloud Motion Invoice SaaS', 0, footerY, { align: 'right' })
        .text('Please keep this invoice for your records.', 0, footerY + 14, {
          align: 'right',
        });

      doc.end();
    });
  }
}
