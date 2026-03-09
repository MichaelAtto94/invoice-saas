-- CreateEnum
CREATE TYPE "RecurringInterval" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "RecurringInvoiceLine" (
    "id" TEXT NOT NULL,
    "recurringInvoiceId" TEXT NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,

    CONSTRAINT "RecurringInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "interval" "RecurringInterval" NOT NULL,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "lastRunDate" TIMESTAMP(3),
    "issueDays" INTEGER NOT NULL DEFAULT 0,
    "dueDays" INTEGER NOT NULL DEFAULT 7,
    "subtotal" INTEGER NOT NULL,
    "taxTotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringInvoiceLine_recurringInvoiceId_idx" ON "RecurringInvoiceLine"("recurringInvoiceId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_tenantId_idx" ON "RecurringInvoice"("tenantId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_clientId_idx" ON "RecurringInvoice"("clientId");

-- AddForeignKey
ALTER TABLE "RecurringInvoiceLine" ADD CONSTRAINT "RecurringInvoiceLine_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
