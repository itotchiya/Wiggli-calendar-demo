-- CreateTable
CREATE TABLE "MeetingNote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "statusMessage" TEXT,
    "source" TEXT NOT NULL DEFAULT 'RECALL_BOT',
    "recallBotId" TEXT,
    "recallRecordingId" TEXT,
    "recallRecordingUrl" TEXT,
    "transcriptText" TEXT,
    "transcriptJson" JSONB,
    "aiRaw" JSONB,
    "summary" JSONB,
    "templateUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "speaker" TEXT,
    "timestamp" TEXT,
    "evidence" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAction" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" TEXT,
    "timestamp" TEXT,
    "evidence" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "NoteAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingNote_eventId_key" ON "MeetingNote"("eventId");

-- CreateIndex
CREATE INDEX "MeetingNote_status_idx" ON "MeetingNote"("status");

-- CreateIndex
CREATE INDEX "MeetingNote_recallBotId_idx" ON "MeetingNote"("recallBotId");

-- CreateIndex
CREATE INDEX "Insight_noteId_reviewStatus_idx" ON "Insight"("noteId", "reviewStatus");

-- CreateIndex
CREATE INDEX "NoteAction_noteId_reviewStatus_idx" ON "NoteAction"("noteId", "reviewStatus");

-- AddForeignKey
ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "MeetingNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAction" ADD CONSTRAINT "NoteAction_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "MeetingNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
