/*
  Warnings:

  - The `priority` column on the `Document` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `classification` column on the `Document` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DocumentPriority" AS ENUM ('ROUTINE', 'URGENT', 'IMMEDIATE');

-- CreateEnum
CREATE TYPE "DocumentClassification" AS ENUM ('SIMPLE', 'COMPLEX', 'HIGHLY_TECHNICAL');

-- CreateEnum
CREATE TYPE "DocumentDelayReason" AS ENUM ('AWAITING_DOCUMENTS', 'FOR_REVIEW_EVALUATION', 'FOR_SIGNATURE_APPROVAL', 'RETURNED_FOR_REVISION', 'EXTERNAL_PARTY_AGENCY', 'FIELD_VALIDATION_INSPECTION');

-- CreateEnum
CREATE TYPE "DocumentActionType" AS ENUM ('APPROPRIATE_ACTION', 'REVIEW_EVALUATION', 'INFORMATION_REFERENCE', 'COMPLIANCE', 'SIGNATURE_APPROVAL', 'REFER', 'REVIEW_RECOMMENDATION', 'COORDINATION', 'DRAFT_REPLY', 'RETURN_FOR_REVISION', 'REFER_TO_DIVISION', 'ASSIGN_TO_SECTION', 'PREPARE_REPLY_OUTPUT', 'INSPECTION_FIELD_ACTION', 'COMPLIANCE_SUBMISSION', 'CLOSE_FILE', 'RETURN_TO_DIVISION');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "delayReason" "DocumentDelayReason",
ADD COLUMN     "receivedAt" TIMESTAMP(3),
DROP COLUMN "priority",
ADD COLUMN     "priority" "DocumentPriority",
DROP COLUMN "classification",
ADD COLUMN     "classification" "DocumentClassification";

-- AlterTable
ALTER TABLE "DocumentAction" ADD COLUMN     "actionType" "DocumentActionType";

-- CreateIndex
CREATE INDEX "DocumentAction_actionType_idx" ON "DocumentAction"("actionType");
