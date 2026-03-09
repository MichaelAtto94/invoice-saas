-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "costPrice" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "costPrice" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuoteLine" ADD COLUMN     "costPrice" INTEGER NOT NULL DEFAULT 0;
