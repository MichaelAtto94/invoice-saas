-- AlterTable
ALTER TABLE "SubscriptionUpgradeRequest" ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentNotes" TEXT,
ADD COLUMN     "paymentProofUrl" TEXT,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentReviewedAt" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "paymentSubmittedAt" TIMESTAMP(3);
