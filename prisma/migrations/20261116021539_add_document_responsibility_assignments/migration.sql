-- Create the normalized responsibility assignments table.
CREATE TABLE "DocumentResponsibility" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "responsiblePerson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentResponsibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentResponsibility_documentId_officeId_key"
ON "DocumentResponsibility"("documentId", "officeId");

CREATE INDEX "DocumentResponsibility_officeId_idx"
ON "DocumentResponsibility"("officeId");

ALTER TABLE "DocumentResponsibility"
ADD CONSTRAINT "DocumentResponsibility_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentResponsibility"
ADD CONSTRAINT "DocumentResponsibility_officeId_fkey"
FOREIGN KEY ("officeId") REFERENCES "Office"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill the current single-office responsibility into the new table.
-- This preserves existing assignments before the application starts using
-- the multi-assignment payload.
INSERT INTO "DocumentResponsibility" (
    "id",
    "documentId",
    "officeId",
    "responsiblePerson",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    d."id",
    d."responsibleOfficeId",
    NULLIF(BTRIM(d."responsiblePerson"), ''),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Document" AS d
WHERE d."responsibleOfficeId" IS NOT NULL
ON CONFLICT ("documentId", "officeId") DO NOTHING;
