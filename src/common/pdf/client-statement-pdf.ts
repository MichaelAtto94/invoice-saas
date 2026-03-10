import PDFDocument from 'pdfkit';
import path from 'path';

function money(cents: number, currencyCode = 'ZMW') {
  const amount = (cents ?? 0) / 100;

  if (amount < 0) {
    return `(${new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(Math.abs(amount))})`;
  }

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date?: Date | null) {
  if (!date) return '-';
  return date.toISOString().slice(0, 10);
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

export async function buildClientStatementPdf(input: {
  company?: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
   
  };
  client: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  period: {
    from?: Date | null;
    to?: Date | null;
  };
  summary: {
    openingBalance: number;
    invoiceTotal: number;
    receiptTotal: number;
    closingBalance: number;
  };
  invoices: Array<{
    number: string;
    status: string;
    issueDate: Date;
    dueDate?: Date | null;
    baseTotal: number;
    amountPaid: number;
  }>;
  receipts: Array<{
    number: string;
    amount: number;
    method?: string | null;
    reference?: string | null;
    createdAt: Date;
    invoice?: { number: string } | null;
  }>;
  currencyCode?: string;
}) {
  const currencyCode = input.currencyCode ?? 'ZMW';

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  //const companyName = input.company?.name ?? 'Cloud Motion Ltd';

  // Header
    const companyName = input.company?.name ?? 'Cloud Motion Ltd';

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
      } catch (e) {
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
      .text('CLIENT STATEMENT', 320, 50, { width: 220, align: 'right' });

    doc
      .font('Helvetica')
      .fontSize(11)
      .text(
        `Period: ${input.period.from ? formatDate(input.period.from) : 'All time'} to ${
          input.period.to ? formatDate(input.period.to) : 'Now'
        }`,
        320,
        85,
        { width: 220, align: 'right' },
      );
  const logoPath = path.join(process.cwd(), 'src/assets/logo.png');

  try {
    doc.image(logoPath, 50, 40, { width: 100 });
  } catch (e) {
    // if logo missing, continue
  }

  doc.font('Helvetica-Bold').fontSize(24).text(companyName, 50, 45);

  doc.font('Helvetica').fontSize(10);

  if (input.company?.address) {
    doc.text(input.company.address, 50, companyY);
    companyY += 14;
  }
  if (input.company?.phone) {
    doc.text(input.company.phone, 50, companyY);
    companyY += 14;
  }
  if (input.company?.email) {
    doc.text(input.company.email, 50, companyY);
    companyY += 14;
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('CLIENT STATEMENT', 320, 50, { width: 220, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(11)
    .text(
      `Period: ${input.period.from ? formatDate(input.period.from) : 'All time'} to ${
        input.period.to ? formatDate(input.period.to) : 'Now'
      }`,
      320,
      85,
      { width: 220, align: 'right' },
    );

  doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#333333').stroke();

  // Client section
  doc.font('Helvetica-Bold').fontSize(13).text('Client', 50, 145);
  doc.font('Helvetica').fontSize(11);

  let clientY = 175;
  doc.text(input.client.name, 50, clientY);
  clientY += 16;

  if (input.client.email) {
    doc.text(input.client.email, 50, clientY);
    clientY += 16;
  }
  if (input.client.phone) {
    doc.text(input.client.phone, 50, clientY);
    clientY += 16;
  }
  if (input.client.address) {
    doc.text(input.client.address, 50, clientY);
  }

  // Summary box
  // Summary box
  doc.roundedRect(300, 145, 245, 150, 12).fillAndStroke('#fafafa', '#cfcfcf');

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#111111')
    .text('Summary', 320, 163);

  doc.font('Helvetica').fontSize(11).fillColor('#333333');

  doc.text('Opening Balance', 320, 195);
  doc.text(money(input.summary.openingBalance, currencyCode), 430, 195, {
    width: 95,
    align: 'right',
  });

  doc.text('Invoices', 320, 220);
  doc.text(money(input.summary.invoiceTotal, currencyCode), 430, 220, {
    width: 95,
    align: 'right',
  });

  doc.text('Receipts', 320, 245);
  doc.text(money(input.summary.receiptTotal, currencyCode), 430, 245, {
    width: 95,
    align: 'right',
  });

  // Divider line before closing balance
  doc.moveTo(320, 272).lineTo(525, 272).strokeColor('#d9d9d9').stroke();

  doc.font('Helvetica-Bold').fillColor('#000000');
  doc.text('Closing Balance', 320, 280);
  doc.text(money(input.summary.closingBalance, currencyCode), 430, 280, {
    width: 95,
    align: 'right',
  });

  // Reset text color
  doc.fillColor('#000000');
  let y = 320;

  // Invoices section
  doc.font('Helvetica-Bold').fontSize(16).text('Invoices', 50, y);
  y += 28;

  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Number', 50, y);
  doc.text('Issue Date', 145, y);
  doc.text('Due Date', 235, y);
  doc.text('Status', 320, y);
  doc.text('Total', 420, y, { width: 70, align: 'right' });
  doc.text('Paid', 500, y, { width: 70, align: 'right' });

  y += 18;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').stroke();

  y += 10;
  doc.font('Helvetica').fontSize(11);

  if (input.invoices.length === 0) {
    doc.text('No invoices in this period.', 50, y);
    y += 20;
  } else {
    for (const inv of input.invoices) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(inv.number, 50, y);
      doc.text(formatDate(inv.issueDate), 145, y);
      doc.text(formatDate(inv.dueDate), 235, y);
      doc.text(formatStatus(inv.status), 320, y, { width: 95 });
      doc.text(money(inv.baseTotal, currencyCode), 420, y, {
        width: 70,
        align: 'right',
      });
      doc.text(money(inv.amountPaid, currencyCode), 500, y, {
        width: 70,
        align: 'right',
      });

      y += 22;
    }
  }

  y += 25;

  // Receipts section
  if (y > 680) {
    doc.addPage();
    y = 50;
  }

  doc.font('Helvetica-Bold').fontSize(16).text('Receipts', 50, y);
  y += 28;

  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Number', 50, y);
  doc.text('Date', 140, y);
  doc.text('Invoice', 215, y);
  doc.text('Method', 305, y);
  doc.text('Reference', 405, y);
  doc.text('Amount', 500, y, { width: 60, align: 'right' });

  y += 18;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').stroke();

  y += 10;
  doc.font('Helvetica').fontSize(11);

  if (input.receipts.length === 0) {
    doc.text('No receipts in this period.', 50, y);
    y += 20;
  } else {
    for (const r of input.receipts) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(r.number, 50, y);
      doc.text(formatDate(r.createdAt), 140, y);
      doc.text(r.invoice?.number ?? '-', 215, y);
      doc.text((r.method ?? '-').replace(/_/g, ' '), 305, y, { width: 90 });
      doc.text(r.reference ?? '-', 405, y, { width: 80 });
      doc.text(money(r.amount, currencyCode), 465, y, {
        width: 80,
        align: 'right',
      });

      y += 22;
    }
  }

  // Footer
  const footerY = 780;
  doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#cccccc').stroke();

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#666666')
    .text(
      `Generated on ${new Date().toISOString().slice(0, 10)}`,
      50,
      footerY + 8,
    )
    .text(companyName, 390, footerY + 8, { width: 155, align: 'right' });

  doc.end();
  return done;
}
