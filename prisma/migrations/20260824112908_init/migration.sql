-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleEventId" TEXT,
    "iCalUID" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL,
    "emailSubject" TEXT,
    "emailHtml" TEXT,
    "organizerEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Attendee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "rsvp" TEXT NOT NULL DEFAULT 'NEEDS_ACTION',
    "respondedAt" DATETIME,
    CONSTRAINT "Attendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RsvpTokenLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendeeEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_iCalUID_key" ON "Event"("iCalUID");

-- CreateIndex
CREATE INDEX "Event_googleEventId_idx" ON "Event"("googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_eventId_email_key" ON "Attendee"("eventId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RsvpTokenLog_token_key" ON "RsvpTokenLog"("token");

-- CreateIndex
CREATE INDEX "RsvpTokenLog_eventId_attendeeEmail_idx" ON "RsvpTokenLog"("eventId", "attendeeEmail");
