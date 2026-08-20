-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerificationTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';
