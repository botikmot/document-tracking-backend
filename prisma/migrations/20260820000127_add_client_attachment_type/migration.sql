-- CreateEnum
CREATE TYPE "ClientApplicationAttachmentType" AS ENUM ('LETTER_REQUEST', 'SUPPORTING_DOCUMENT');

-- AlterTable
ALTER TABLE "ClientApplicationAttachment" ADD COLUMN     "type" "ClientApplicationAttachmentType" NOT NULL DEFAULT 'SUPPORTING_DOCUMENT';

-- CreateIndex
CREATE INDEX "ClientApplicationAttachment_type_idx" ON "ClientApplicationAttachment"("type");
