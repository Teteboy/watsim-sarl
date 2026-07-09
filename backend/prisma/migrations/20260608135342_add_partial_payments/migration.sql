/*
  Warnings:

  - Added the required column `updatedAt` to the `Instalment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "InstalmentStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "Instalment" ADD COLUMN     "paidAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storageFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
