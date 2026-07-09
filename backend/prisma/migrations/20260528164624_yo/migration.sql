-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "markupPercentage" DECIMAL(65,30) NOT NULL DEFAULT 20.0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deliveryFee" INTEGER DEFAULT 0,
ADD COLUMN     "storageFee" INTEGER DEFAULT 0;
