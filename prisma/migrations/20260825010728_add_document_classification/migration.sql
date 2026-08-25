-- CreateEnum
CREATE TYPE "DocumentSourceClass" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "InternalSourceScope" AS ENUM ('LOCAL_CARAGA', 'OTHER_REGION', 'CENTRAL_OFFICE');

-- CreateEnum
CREATE TYPE "DocumentMonitoringCategory" AS ENUM ('GENERAL', 'PERMIT', 'SURVEY_RETURN');

-- CreateEnum
CREATE TYPE "DocumentRoutingProfile" AS ENUM ('STANDARD', 'DIRECT_TO_ACTION_OFFICE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "internalSourceScope" "InternalSourceScope",
ADD COLUMN     "monitoringCategory" "DocumentMonitoringCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "routingProfile" "DocumentRoutingProfile" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "sourceClass" "DocumentSourceClass";

-- CreateIndex
CREATE INDEX "Document_sourceClass_idx" ON "Document"("sourceClass");

-- CreateIndex
CREATE INDEX "Document_internalSourceScope_idx" ON "Document"("internalSourceScope");

-- CreateIndex
CREATE INDEX "Document_monitoringCategory_idx" ON "Document"("monitoringCategory");

-- CreateIndex
CREATE INDEX "Document_routingProfile_idx" ON "Document"("routingProfile");
