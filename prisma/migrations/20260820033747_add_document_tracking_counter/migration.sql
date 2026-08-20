-- CreateTable
CREATE TABLE "DocumentTrackingCounter" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTrackingCounter_pkey" PRIMARY KEY ("year")
);
