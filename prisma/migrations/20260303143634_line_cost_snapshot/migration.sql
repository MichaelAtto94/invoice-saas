/*
  Warnings:

  - You are about to alter the column `unitPrice` on the `Item` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Item" ALTER COLUMN "unitPrice" SET DEFAULT 0,
ALTER COLUMN "unitPrice" SET DATA TYPE INTEGER;
