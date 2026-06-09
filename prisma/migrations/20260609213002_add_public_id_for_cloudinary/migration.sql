/*
  Warnings:

  - Added the required column `publicId` to the `DocumentAttachment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DocumentAttachment" ADD COLUMN     "publicId" TEXT NOT NULL;
