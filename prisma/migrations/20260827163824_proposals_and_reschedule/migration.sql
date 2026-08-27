-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "rescheduleNote" TEXT,
ADD COLUMN     "rescheduledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EventProposal" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendeeEmail" TEXT NOT NULL,
    "slotLabel" TEXT NOT NULL,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'gmail-notification',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventProposal_eventId_idx" ON "EventProposal"("eventId");

-- AddForeignKey
ALTER TABLE "EventProposal" ADD CONSTRAINT "EventProposal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
