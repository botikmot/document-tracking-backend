-- CreateEnum
CREATE TYPE "OfficeCategory" AS ENUM ('REGULAR', 'RECORDS');

-- AlterTable
ALTER TABLE "Office" ADD COLUMN     "category" "OfficeCategory" NOT NULL DEFAULT 'REGULAR';
