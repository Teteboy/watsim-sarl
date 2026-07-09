-- Add referralCode column to User table
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;

-- Create unique index on referralCode
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
