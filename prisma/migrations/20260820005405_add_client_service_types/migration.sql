-- AlterTable
ALTER TABLE "ClientApplication" ADD COLUMN     "serviceTypeId" TEXT;

-- CreateTable
CREATE TABLE "ClientServiceType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ClientApplicationKind" NOT NULL,
    "requiresLetterRequest" BOOLEAN NOT NULL DEFAULT false,
    "requiresTrackingNumber" BOOLEAN NOT NULL DEFAULT false,
    "allowsAttachments" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "receivingOfficeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientServiceType_code_key" ON "ClientServiceType"("code");

-- CreateIndex
CREATE INDEX "ClientServiceType_kind_idx" ON "ClientServiceType"("kind");

-- CreateIndex
CREATE INDEX "ClientServiceType_isActive_idx" ON "ClientServiceType"("isActive");

-- CreateIndex
CREATE INDEX "ClientServiceType_receivingOfficeId_idx" ON "ClientServiceType"("receivingOfficeId");

-- CreateIndex
CREATE INDEX "ClientApplication_serviceTypeId_idx" ON "ClientApplication"("serviceTypeId");

-- AddForeignKey
ALTER TABLE "ClientApplication" ADD CONSTRAINT "ClientApplication_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ClientServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServiceType" ADD CONSTRAINT "ClientServiceType_receivingOfficeId_fkey" FOREIGN KEY ("receivingOfficeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
