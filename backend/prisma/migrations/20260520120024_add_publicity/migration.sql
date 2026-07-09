-- CreateEnum
CREATE TYPE "PublicityType" AS ENUM ('BANNER', 'VIDEO', 'POPUP', 'NATIVE');

-- CreateEnum
CREATE TYPE "PublicityStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PublicityPosition" AS ENUM ('HOMEPAGE_HERO', 'CATEGORY_TOP', 'PRODUCT_DETAIL', 'CHECKOUT');

-- CreateTable
CREATE TABLE "Publicity" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "name" TEXT NOT NULL,
    "type" "PublicityType" NOT NULL,
    "position" "PublicityPosition" NOT NULL,
    "budget" INTEGER NOT NULL DEFAULT 0,
    "spent" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "status" "PublicityStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publicity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Publicity" ADD CONSTRAINT "Publicity_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
