import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

function generatePublicId() {
  return 'inv_' + randomBytes(5).toString('hex');
}

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      publicId: null,
    },
    select: {
      id: true,
      number: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`Found ${invoices.length} invoices without publicId`);

  for (const invoice of invoices) {
    let publicId = generatePublicId();

    while (await prisma.invoice.findFirst({ where: { publicId } })) {
      publicId = generatePublicId();
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { publicId },
    });

    console.log(`Updated ${invoice.number} -> ${publicId}`);
  }

  console.log('Backfill complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
