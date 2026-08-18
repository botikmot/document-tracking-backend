-- CreateTable
CREATE TABLE "DocumentAction" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "comment" TEXT,
    "fileName" TEXT,
    "filePath" TEXT,
    "fileType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAction_documentId_idx" ON "DocumentAction"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAction_userId_idx" ON "DocumentAction"("userId");

-- CreateIndex
CREATE INDEX "DocumentAction_officeId_idx" ON "DocumentAction"("officeId");

-- AddForeignKey
ALTER TABLE "DocumentAction" ADD CONSTRAINT "DocumentAction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAction" ADD CONSTRAINT "DocumentAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAction" ADD CONSTRAINT "DocumentAction_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
