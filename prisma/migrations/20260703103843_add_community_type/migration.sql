-- CreateEnum
CREATE TYPE "CommunityType" AS ENUM ('CHANNEL', 'DIRECT');

-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "type" "CommunityType" NOT NULL DEFAULT 'CHANNEL';
