-- Track whether an event was created in Wiggli or imported from Google Calendar.
ALTER TABLE "Event" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'WIGGLI';
CREATE INDEX "Event_source_idx" ON "Event"("source");
