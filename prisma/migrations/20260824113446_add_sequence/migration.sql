-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
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
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("createdAt", "description", "emailHtml", "emailSubject", "end", "googleEventId", "iCalUID", "id", "location", "organizerEmail", "start", "summary", "timezone", "updatedAt") SELECT "createdAt", "description", "emailHtml", "emailSubject", "end", "googleEventId", "iCalUID", "id", "location", "organizerEmail", "start", "summary", "timezone", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_iCalUID_key" ON "Event"("iCalUID");
CREATE INDEX "Event_googleEventId_idx" ON "Event"("googleEventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
