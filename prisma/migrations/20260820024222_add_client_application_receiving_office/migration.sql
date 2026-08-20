-- AlterTable
ALTER TABLE "ClientApplication" ADD COLUMN     "receivingOfficeId" TEXT;

-- AddForeignKey
ALTER TABLE "ClientApplication" ADD CONSTRAINT "ClientApplication_receivingOfficeId_fkey" FOREIGN KEY ("receivingOfficeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
