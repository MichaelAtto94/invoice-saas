-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('ZMW', 'USD', 'ZAR', 'EUR', 'GBP');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "baseTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currency" "CurrencyCode" NOT NULL DEFAULT 'ZMW',
ADD COLUMN     "fxRateToBase" INTEGER NOT NULL DEFAULT 1000000;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "baseTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currency" "CurrencyCode" NOT NULL DEFAULT 'ZMW',
ADD COLUMN     "fxRateToBase" INTEGER NOT NULL DEFAULT 1000000;

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "from" "CurrencyCode" NOT NULL,
    "to" "CurrencyCode" NOT NULL,
    "rate" INTEGER NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_tenantId_idx" ON "ExchangeRate"("tenantId");
