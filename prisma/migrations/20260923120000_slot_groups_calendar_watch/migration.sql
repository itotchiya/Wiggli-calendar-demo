-- Multi-slot invites: group sibling slots, remember each invite's Gmail thread,
-- and store the organizer's Google Calendar push channel.
ALTER TABLE "Event" ADD COLUMN "slotGroupId" TEXT;
CREATE INDEX "Event_slotGroupId_idx" ON "Event"("slotGroupId");

ALTER TABLE "Attendee" ADD COLUMN "inviteThreadId" TEXT;
ALTER TABLE "Attendee" ADD COLUMN "inviteMessageId" TEXT;

ALTER TABLE "OrganizerAccount" ADD COLUMN "calendarChannelId" TEXT;
ALTER TABLE "OrganizerAccount" ADD COLUMN "calendarChannelResourceId" TEXT;
ALTER TABLE "OrganizerAccount" ADD COLUMN "calendarChannelToken" TEXT;
ALTER TABLE "OrganizerAccount" ADD COLUMN "calendarChannelAddress" TEXT;
ALTER TABLE "OrganizerAccount" ADD COLUMN "calendarChannelExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "OrganizerAccount_calendarChannelId_key" ON "OrganizerAccount"("calendarChannelId");
