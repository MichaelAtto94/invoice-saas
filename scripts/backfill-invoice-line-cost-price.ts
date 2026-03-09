import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Only lines with missing/zero costPrice
  const lines = await prisma.invoiceLine.findMany({
    where: {
      OR: [
        { costPrice: 0 },
        { costPrice: null as any }, // safe if schema allows null in old DB states
      ],
    },
    select: {
      id: true,
      itemId: true,
      name: true,
      invoiceId: true,
      invoice: {
        select: {
          quoteId: true,
        },
      },
    },
  });

  console.log(`Found ${lines.length} invoice lines to inspect`);

  let updated = 0;
  let skipped = 0;

  for (const line of lines) {
    let costPrice = 0;

    // 1) Prefer Item.costPrice if item is linked
    if (line.itemId) {
      const item = await prisma.item.findUnique({
        where: { id: line.itemId },
        select: { costPrice: true },
      });

      if (item && typeof item.costPrice === 'number') {
        costPrice = item.costPrice;
      }
    }

    // 2) If still zero, try matching QuoteLine from source quote
    if ((!costPrice || costPrice === 0) && line.invoice.quoteId) {
      const quoteLine = await prisma.quoteLine.findFirst({
        where: {
          quoteId: line.invoice.quoteId,
          name: line.name,
        },
        select: { costPrice: true },
      });

      if (quoteLine && typeof quoteLine.costPrice === 'number') {
        costPrice = quoteLine.costPrice;
      }
    }

    if (costPrice > 0) {
      await prisma.invoiceLine.update({
        where: { id: line.id },
        data: { costPrice },
      });
      updated++;
      console.log(`Updated line ${line.id} -> costPrice=${costPrice}`);
    } else {
      skipped++;
      console.log(`Skipped line ${line.id} (no item/quote cost found)`);
    }
  }

  console.log({ updated, skipped, total: lines.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
