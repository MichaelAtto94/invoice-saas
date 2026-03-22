-- CreateTable
CREATE TABLE "SubscriptionUpgradeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedPlanCode" TEXT NOT NULL,
    "currentPlanCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "SubscriptionUpgradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionUpgradeRequest_tenantId_idx" ON "SubscriptionUpgradeRequest"("tenantId");

-- CreateIndex
CREATE INDEX "SubscriptionUpgradeRequest_status_idx" ON "SubscriptionUpgradeRequest"("status");

-- CreateIndex
CREATE INDEX "SubscriptionUpgradeRequest_requestedAt_idx" ON "SubscriptionUpgradeRequest"("requestedAt");

-- AddForeignKey
ALTER TABLE "SubscriptionUpgradeRequest" ADD CONSTRAINT "SubscriptionUpgradeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
