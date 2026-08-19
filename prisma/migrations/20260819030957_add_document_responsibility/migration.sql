-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "responsibleOfficeId" TEXT,
ADD COLUMN     "responsiblePersonId" TEXT;

-- CreateIndex
CREATE INDEX "Document_responsibleOfficeId_idx" ON "Document"("responsibleOfficeId");

-- CreateIndex
CREATE INDEX "Document_responsiblePersonId_idx" ON "Document"("responsiblePersonId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_responsibleOfficeId_fkey" FOREIGN KEY ("responsibleOfficeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
