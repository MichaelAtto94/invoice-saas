import PDFDocument from 'pdfkit';

export async function buildReceiptPdf(input: {
  receiptNumber: string;
  receivedAt: Date;
  tenantName: string;

  invoiceNumber: string;
  clientName: string;

  amount: number; // cents
  method: string;
  reference?: string | null;
  notes?: string | null;
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  doc.fontSize(18).text(input.tenantName);
  doc.moveDown(0.5);

  doc.fontSize(14).text(`RECEIPT: ${input.receiptNumber}`);
  doc.fontSize(10).text(`Date: ${input.receivedAt.toISOString().slice(0, 10)}`);
  doc.moveDown();

  doc.fontSize(12).text(`Invoice: ${input.invoiceNumber}`);
  doc.text(`Client: ${input.clientName}`);
  doc.moveDown();

  doc.fontSize(12).text(`Amount Paid: ${(input.amount / 100).toFixed(2)}`);
  doc.text(`Method: ${input.method}`);
  if (input.reference) doc.text(`Reference: ${input.reference}`);
  if (input.notes) doc.text(`Notes: ${input.notes}`);
  doc.moveDown();

  doc.fontSize(10).text('Thank you.');

  doc.end();
  return done;
}
