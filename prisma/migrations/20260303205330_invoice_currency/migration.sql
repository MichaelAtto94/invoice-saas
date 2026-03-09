/*
  Warnings:

  - The `currencyCode` column on the `Tenant` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "currencyCode" "CurrencyCode" NOT NULL DEFAULT 'ZMW',
ADD COLUMN     "fxFrom" "CurrencyCode",
ADD COLUMN     "fxRate" INTEGER;

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "currencyCode",
ADD COLUMN     "currencyCode" "CurrencyCode" NOT NULL DEFAULT 'ZMW';
