-- AlterTable
ALTER TABLE "ClientApplication" ADD COLUMN     "additionalRequirementsRemarks" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewRemarks" TEXT,
ADD COLUMN     "reviewedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "ClientApplication_kind_idx" ON "ClientApplication"("kind");

-- CreateIndex
CREATE INDEX "ClientApplication_reviewedByUserId_idx" ON "ClientApplication"("reviewedByUserId");
