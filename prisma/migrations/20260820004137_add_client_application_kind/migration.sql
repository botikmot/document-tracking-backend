-- CreateEnum
CREATE TYPE "ClientApplicationKind" AS ENUM ('APPLICATION', 'DOCUMENT_REQUEST', 'FOLLOW_UP', 'GENERAL_INQUIRY');

-- AlterTable
ALTER TABLE "ClientApplication" ADD COLUMN     "kind" "ClientApplicationKind" NOT NULL DEFAULT 'APPLICATION',
ADD COLUMN     "relatedTrackingNumber" TEXT;
