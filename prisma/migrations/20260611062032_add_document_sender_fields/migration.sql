-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "senderContact" TEXT,
ADD COLUMN     "senderName" TEXT,
ADD COLUMN     "senderOfficeId" TEXT,
ADD COLUMN     "senderOrganization" TEXT,
ADD COLUMN     "senderType" TEXT;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_senderOfficeId_fkey" FOREIGN KEY ("senderOfficeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
