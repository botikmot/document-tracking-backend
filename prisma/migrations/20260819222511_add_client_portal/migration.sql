-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "ClientApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_REQUIREMENTS', 'RESUBMITTED', 'ACCEPTED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "suffix" TEXT,
    "email" TEXT NOT NULL,
    "mobileNumber" TEXT,
    "address" TEXT,
    "organizationName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientApplication" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ClientApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "documentId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "resubmittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientApplicationAttachment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientApplicationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Client_lastName_firstName_idx" ON "Client"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientApplication_referenceNumber_key" ON "ClientApplication"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClientApplication_documentId_key" ON "ClientApplication"("documentId");

-- CreateIndex
CREATE INDEX "ClientApplication_clientId_idx" ON "ClientApplication"("clientId");

-- CreateIndex
CREATE INDEX "ClientApplication_status_idx" ON "ClientApplication"("status");

-- CreateIndex
CREATE INDEX "ClientApplication_createdAt_idx" ON "ClientApplication"("createdAt");

-- CreateIndex
CREATE INDEX "ClientApplicationAttachment_applicationId_idx" ON "ClientApplicationAttachment"("applicationId");

-- AddForeignKey
ALTER TABLE "ClientApplication" ADD CONSTRAINT "ClientApplication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApplication" ADD CONSTRAINT "ClientApplication_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApplicationAttachment" ADD CONSTRAINT "ClientApplicationAttachment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "ClientApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
