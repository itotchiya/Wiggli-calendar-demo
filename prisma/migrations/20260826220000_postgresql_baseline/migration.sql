-- PostgreSQL baseline for the first durable Vercel deployment.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "googleEventId" TEXT,
    "iCalUID" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "eventType" TEXT,
    "description" TEXT,
    "location" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "emailSubject" TEXT,
    "emailHtml" TEXT,
    "organizerEmail" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "hangoutLink" TEXT,
    "reminderMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT,
    "rsvp" TEXT NOT NULL DEFAULT 'NEEDS_ACTION',
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizerAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "refreshToken" TEXT,
    "calendarAlias" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizerAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RsvpTokenLog" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendeeEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RsvpTokenLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Event_iCalUID_key" ON "Event"("iCalUID");
CREATE INDEX "Event_googleEventId_idx" ON "Event"("googleEventId");
CREATE UNIQUE INDEX "Attendee_eventId_email_key" ON "Attendee"("eventId", "email");
CREATE UNIQUE INDEX "OrganizerAccount_email_key" ON "OrganizerAccount"("email");
CREATE UNIQUE INDEX "OrganizerAccount_calendarAlias_key" ON "OrganizerAccount"("calendarAlias");
CREATE UNIQUE INDEX "RsvpTokenLog_dedupeKey_key" ON "RsvpTokenLog"("dedupeKey");
CREATE INDEX "RsvpTokenLog_eventId_attendeeEmail_idx" ON "RsvpTokenLog"("eventId", "attendeeEmail");
CREATE INDEX "RsvpTokenLog_token_idx" ON "RsvpTokenLog"("token");

ALTER TABLE "Attendee"
ADD CONSTRAINT "Attendee_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
