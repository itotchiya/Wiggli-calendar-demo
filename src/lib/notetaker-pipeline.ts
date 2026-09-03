/** Shared notetaker pipeline: transcript text → Gemini → Neon rows. */
import { db } from "@/lib/prisma";
import {
  analyzeTranscript,
  buildContextPacket,
  type NotetakerOutput,
} from "@/lib/notetaker";

/** Run the ONE Gemini analysis for a note that already has transcriptText. */
export async function runAnalysis(noteId: string): Promise<{ templateUsed: string }> {
  const note = await db.meetingNote.findUnique({
    where: { id: noteId },
    include: { event: { include: { attendees: true } } },
  });
  if (!note) throw new Error("Meeting note not found.");
  if (!note.transcriptText) throw new Error("No transcript to analyze.");

  await db.meetingNote.update({ where: { id: noteId }, data: { status: "PROCESSING", statusMessage: null } });

  try {
    const context = buildContextPacket({
      title: note.event.summary,
      eventType: note.event.eventType,
      description: note.event.description,
      start: note.event.start,
      attendees: note.event.attendees.map((a) => ({ email: a.email, name: a.name, type: a.type })),
      previewData: note.event.previewData,
    });
    const { output, raw, templateUsed } = await analyzeTranscript(context, note.transcriptText);
    await saveAiOutput(noteId, output, raw, templateUsed);
    return { templateUsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI analysis failed.";
    await db.meetingNote.update({ where: { id: noteId }, data: { status: "FAILED", statusMessage: message } });
    throw err;
  }
}

export async function saveAiOutput(
  noteId: string,
  output: NotetakerOutput,
  raw: unknown,
  templateUsed: string
): Promise<void> {
  await db.$transaction([
    db.insight.deleteMany({ where: { noteId } }),
    db.noteAction.deleteMany({ where: { noteId } }),
    db.meetingNote.update({
      where: { id: noteId },
      data: { status: "READY", statusMessage: null, aiRaw: raw as object, summary: output.summary as object, templateUsed },
    }),
    db.insight.createMany({
      data: output.candidate_insights.map((i) => ({
        noteId,
        field: String(i.field ?? "note").slice(0, 80),
        value: String(i.value ?? "").slice(0, 2000),
        confidence: typeof i.confidence === "number" ? i.confidence : null,
        speaker: typeof i.speaker === "string" ? i.speaker.slice(0, 40) : null,
        timestamp: typeof i.timestamp === "string" ? i.timestamp.slice(0, 20) : null,
        evidence: typeof i.evidence === "string" ? i.evidence.slice(0, 2000) : null,
      })),
    }),
    db.noteAction.createMany({
      data: output.action_items.map((a) => ({
        noteId,
        title: String(a.title ?? "Follow-up").slice(0, 500),
        owner: typeof a.owner === "string" ? a.owner.slice(0, 40) : null,
        dueDate: typeof a.due_date === "string" ? a.due_date.slice(0, 80) : null,
        timestamp: typeof a.timestamp === "string" ? a.timestamp.slice(0, 20) : null,
        evidence: typeof a.evidence === "string" ? a.evidence.slice(0, 2000) : null,
      })),
    }),
  ]);
}
