/*
  Warnings:

  - You are about to drop the column `responsiblePersonId` on the `Document` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_responsiblePersonId_fkey";

-- DropIndex
DROP INDEX "Document_responsiblePersonId_idx";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "responsiblePersonId",
ADD COLUMN     "responsiblePerson" TEXT;
