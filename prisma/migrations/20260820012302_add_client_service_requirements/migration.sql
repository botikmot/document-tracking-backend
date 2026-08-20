-- AlterTable
ALTER TABLE "ClientApplicationAttachment" ADD COLUMN     "requirementId" TEXT;

-- CreateTable
CREATE TABLE "ClientServiceRequirement" (
    "id" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "allowsMultiple" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientServiceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientServiceRequirement_serviceTypeId_idx" ON "ClientServiceRequirement"("serviceTypeId");

-- CreateIndex
CREATE INDEX "ClientServiceRequirement_isActive_idx" ON "ClientServiceRequirement"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClientServiceRequirement_serviceTypeId_code_key" ON "ClientServiceRequirement"("serviceTypeId", "code");

-- CreateIndex
CREATE INDEX "ClientApplicationAttachment_requirementId_idx" ON "ClientApplicationAttachment"("requirementId");

-- AddForeignKey
ALTER TABLE "ClientApplicationAttachment" ADD CONSTRAINT "ClientApplicationAttachment_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ClientServiceRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServiceRequirement" ADD CONSTRAINT "ClientServiceRequirement_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ClientServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
