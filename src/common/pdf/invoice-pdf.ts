import PDFDocument from 'pdfkit';

import { formatMoney } from '../money/format';

type InvoicePdfInput = {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | null;
  status: string;

  currencyCode: string;

  tenantName: string;
  tenantSlug: string;

  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;

  lines: {
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number; // cents
    lineTotal: number; // cents
  }[];

  subtotal: number; // cents
  taxTotal: number; // cents
  total: number; // cents
  amountPaid: number; // cents
};

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

export function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ===== PDF CONTENT =====
    doc.fontSize(18).text(input.tenantName);
    doc.fontSize(10).fillColor('gray').text(`Tenant: ${input.tenantSlug}`);
    doc.fillColor('black');
    doc.moveDown();

    doc.fontSize(16).text(`INVOICE ${input.invoiceNumber}`, { align: 'right' });
    doc.fontSize(10).text(`Status: ${input.status}`, { align: 'right' });
    doc.text(`Issue: ${input.issueDate.toISOString().slice(0, 10)}`, {
      align: 'right',
    });
    doc.text(`Due: ${input.dueDate ? input.dueDate.toISOString().slice(0, 10) : '-'}`, {
      align: 'right',
    });
    doc.moveDown();

    doc.fontSize(12).text('Bill To:', { underline: true });
    doc.fontSize(11).text(input.clientName);
    if (input.clientEmail) doc.text(input.clientEmail);
    if (input.clientPhone) doc.text(input.clientPhone);
    doc.moveDown();

    // Table header
    doc.fontSize(11).text('Item', 50, doc.y, { width: 260 });
    doc.text('Qty', 320, doc.y, { width: 50, align: 'right' });
    doc.text('Unit', 370, doc.y, { width: 80, align: 'right' });
    doc.text('Total', 450, doc.y, { width: 90, align: 'right' });

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.6);

    // Lines
    for (const l of input.lines) {
      doc.fontSize(10).text(l.name, 50, doc.y, { width: 260 });
      doc.text(String(l.quantity), 320, doc.y, { width: 50, align: 'right' });
      doc.text(money(l.unitPrice), 370, doc.y, { width: 80, align: 'right' });
      doc.text(money(l.lineTotal), 450, doc.y, { width: 90, align: 'right' });

      if (l.description) {
        doc.fillColor('gray')
          .fontSize(9)
          .text(l.description, 50, doc.y, { width: 260 });
        doc.fillColor('black');
      }
      doc.moveDown(0.6);
    }

    doc.moveDown();
    doc.moveTo(300, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.6);

    doc.fontSize(11).text(`Subtotal: ${money(input.subtotal)}`, 300, doc.y, {
      width: 245,
      align: 'right',
    });
    doc.text(`Tax: ${money(input.taxTotal)}`, 300, doc.y, {
      width: 245,
      align: 'right',
    });
    doc.fontSize(12).text(`Total: ${money(input.total)}`, 300, doc.y, {
      width: 245,
      align: 'right',
    });
    doc.fontSize(11).text(`Paid: ${money(input.amountPaid)}`, 300, doc.y, {
      width: 245,
      align: 'right',
    });
    doc.text(`Balance: ${money(input.total - input.amountPaid)}`, 300, doc.y, {
      width: 245,
      align: 'right',
    });

    // ✅ MUST end the document
    doc.end();
  });
}
