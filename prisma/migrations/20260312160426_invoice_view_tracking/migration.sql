-- CreateTable
CREATE TABLE "InvoiceView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceView_invoiceId_idx" ON "InvoiceView"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceView_publicId_idx" ON "InvoiceView"("publicId");

-- CreateIndex
CREATE INDEX "InvoiceView_tenantId_idx" ON "InvoiceView"("tenantId");
