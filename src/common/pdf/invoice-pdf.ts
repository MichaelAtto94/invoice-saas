import PDFDocument from 'pdfkit';
import path from 'path';
import { formatMoney } from '../money/format';

type InvoicePdfInput = {
  company?: {
    name?: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
  };

  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | null;
  status: string;

  currencyCode: string;

  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress?: string | null;

  lines: {
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];

  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
};

function formatDate(date?: Date | null) {
  if (!date) return '-';
  return date.toISOString().slice(0, 10);
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
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

    const companyName = input.company?.name ?? 'Company';

    // Header with optional logo
    let titleX = 50;

    if (input.company?.logoUrl) {
      try {
        const logoPath = path.isAbsolute(input.company.logoUrl)
          ? input.company.logoUrl
          : path.join(process.cwd(), input.company.logoUrl);

        doc.image(logoPath, 50, 35, {
          width: 90,
          height: 90,
          fit: [90, 90],
        });

        titleX = 160;
      } catch {
        titleX = 50;
      }
    }

    doc.font('Helvetica-Bold').fontSize(24).text(companyName, titleX, 40);

    doc.font('Helvetica').fontSize(10);
    let companyY = 70;

    if (input.company?.address) {
      doc.text(input.company.address, titleX, companyY);
      companyY += 14;
    }
    if (input.company?.phone) {
      doc.text(input.company.phone, titleX, companyY);
      companyY += 14;
    }
    if (input.company?.email) {
      doc.text(input.company.email, titleX, companyY);
      companyY += 14;
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('INVOICE', 320, 40, { width: 220, align: 'right' });

    doc
      .font('Helvetica')
      .fontSize(11)
      .text(`Invoice No: ${input.invoiceNumber}`, 320, 68, {
        width: 220,
        align: 'right',
      })
      .text(`Status: ${formatStatus(input.status)}`, 320, 84, {
        width: 220,
        align: 'right',
      })
      .text(`Issue Date: ${formatDate(input.issueDate)}`, 320, 100, {
        width: 220,
        align: 'right',
      })
      .text(`Due Date: ${formatDate(input.dueDate)}`, 320, 116, {
        width: 220,
        align: 'right',
      });

    doc.moveTo(50, 140).lineTo(545, 140).strokeColor('#333333').stroke();

    // Bill to
    doc.font('Helvetica-Bold').fontSize(13).text('Bill To', 50, 160);
    doc.font('Helvetica').fontSize(11);

    let clientY = 185;
    doc.text(input.clientName, 50, clientY);
    clientY += 16;

    if (input.clientEmail) {
      doc.text(input.clientEmail, 50, clientY);
      clientY += 16;
    }
    if (input.clientPhone) {
      doc.text(input.clientPhone, 50, clientY);
      clientY += 16;
    }
    if (input.clientAddress) {
      doc.text(input.clientAddress, 50, clientY);
    }

    // Totals summary box
    doc.roundedRect(320, 160, 225, 130, 10).fillAndStroke('#fafafa', '#cccccc');

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#111111')
      .text('Summary', 340, 178);

    doc.font('Helvetica').fontSize(11).fillColor('#333333');

    doc.text('Subtotal', 340, 205);
    doc.text(formatMoney(input.subtotal, input.currencyCode), 430, 205, {
      width: 95,
      align: 'right',
    });

    doc.text('Tax', 340, 228);
    doc.text(formatMoney(input.taxTotal, input.currencyCode), 430, 228, {
      width: 95,
      align: 'right',
    });

    doc.text('Paid', 340, 251);
    doc.text(formatMoney(input.amountPaid, input.currencyCode), 430, 251, {
      width: 95,
      align: 'right',
    });

    doc.moveTo(340, 274).lineTo(525, 274).strokeColor('#d9d9d9').stroke();

    doc.font('Helvetica-Bold').fillColor('#000000');
    doc.text('Balance', 340, 282);
    doc.text(
      formatMoney(input.total - input.amountPaid, input.currencyCode),
      430,
      282,
      {
        width: 95,
        align: 'right',
      },
    );

    doc.fillColor('#000000');

    let y = 330;

    // Lines table
    doc.font('Helvetica-Bold').fontSize(16).text('Items', 50, y);
    y += 28;

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Item', 50, y);
    doc.text('Qty', 310, y, { width: 40, align: 'right' });
    doc.text('Unit Price', 365, y, { width: 80, align: 'right' });
    doc.text('Total', 460, y, { width: 85, align: 'right' });

    y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').stroke();

    y += 10;
    doc.font('Helvetica').fontSize(11);

    for (const line of input.lines) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(line.name, 50, y, { width: 240 });
      doc.text(String(line.quantity), 310, y, { width: 40, align: 'right' });
      doc.text(formatMoney(line.unitPrice, input.currencyCode), 365, y, {
        width: 80,
        align: 'right',
      });
      doc.text(formatMoney(line.lineTotal, input.currencyCode), 460, y, {
        width: 85,
        align: 'right',
      });

      y += 16;

      if (line.description) {
        doc.fillColor('#666666').fontSize(9).text(line.description, 50, y, {
          width: 240,
        });
        doc.fillColor('#000000');
        y += 16;
      }

      y += 8;
    }

    y += 10;

    if (y > 690) {
      doc.addPage();
      y = 50;
    }

    doc.moveTo(330, y).lineTo(545, y).strokeColor('#cccccc').stroke();

    y += 12;

    doc.font('Helvetica').fontSize(11);
    doc.text('Subtotal', 365, y, { width: 80 });
    doc.text(formatMoney(input.subtotal, input.currencyCode), 460, y, {
      width: 85,
      align: 'right',
    });

    y += 18;
    doc.text('Tax', 365, y, { width: 80 });
    doc.text(formatMoney(input.taxTotal, input.currencyCode), 460, y, {
      width: 85,
      align: 'right',
    });

    y += 18;
    doc.font('Helvetica-Bold');
    doc.text('Total', 365, y, { width: 80 });
    doc.text(formatMoney(input.total, input.currencyCode), 460, y, {
      width: 85,
      align: 'right',
    });

    y += 18;
    doc.font('Helvetica');
    doc.text('Paid', 365, y, { width: 80 });
    doc.text(formatMoney(input.amountPaid, input.currencyCode), 460, y, {
      width: 85,
      align: 'right',
    });

    y += 18;
    doc.font('Helvetica-Bold');
    doc.text('Balance', 365, y, { width: 80 });
    doc.text(
      formatMoney(input.total - input.amountPaid, input.currencyCode),
      460,
      y,
      {
        width: 85,
        align: 'right',
      },
    );

    // Footer
    const footerY = 780;
    doc
      .moveTo(50, footerY)
      .lineTo(545, footerY)
      .strokeColor('#cccccc')
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#666666')
      .text(
        `Generated on ${new Date().toISOString().slice(0, 10)}`,
        50,
        footerY + 8,
      )
      .text(companyName, 390, footerY + 8, {
        width: 155,
        align: 'right',
      });

    doc.end();
  });
}
