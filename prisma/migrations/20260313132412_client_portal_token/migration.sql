/*
  Warnings:

  - A unique constraint covering the columns `[portalToken]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "portalToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_portalToken_key" ON "Client"("portalToken");
