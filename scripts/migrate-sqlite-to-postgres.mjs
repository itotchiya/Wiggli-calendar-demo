import "dotenv/config";

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const sourcePath = resolve(process.argv[2] ?? "dev.db");
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!existsSync(sourcePath)) {
  throw new Error(`SQLite source not found: ${sourcePath}`);
}

if (!connectionString?.startsWith("postgres")) {
  throw new Error("DIRECT_URL or DATABASE_URL must point to PostgreSQL");
}

function readTable(table) {
  const output = execFileSync(
    "sqlite3",
    ["-readonly", "-json", sourcePath, `SELECT * FROM "${table}"`],
    { encoding: "utf8" },
  ).trim();

  return output ? JSON.parse(output) : [];
}

const source = {
  events: readTable("Event"),
  attendees: readTable("Attendee"),
  organizers: readTable("OrganizerAccount"),
  rsvpLogs: readTable("RsvpTokenLog"),
};

const client = new Client({ connectionString });
const eventIdMap = new Map();

await client.connect();

try {
  await client.query("BEGIN");

  for (const row of source.organizers) {
    await client.query(
      `
        INSERT INTO "OrganizerAccount"
          ("id", "email", "refreshToken", "calendarAlias", "createdAt")
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ("email") DO UPDATE SET
          "refreshToken" = COALESCE("OrganizerAccount"."refreshToken", EXCLUDED."refreshToken"),
          "calendarAlias" = COALESCE("OrganizerAccount"."calendarAlias", EXCLUDED."calendarAlias")
      `,
      [row.id, row.email, row.refreshToken, row.calendarAlias, row.createdAt],
    );
  }

  for (const row of source.events) {
    const inserted = await client.query(
      `
        INSERT INTO "Event"
          ("id", "googleEventId", "iCalUID", "summary", "eventType",
           "description", "location", "start", "end", "timezone",
           "emailSubject", "emailHtml", "organizerEmail", "sequence",
           "hangoutLink", "reminderMinutes", "createdAt", "updatedAt")
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
           $14, $15, $16, $17, $18)
        ON CONFLICT ("iCalUID") DO NOTHING
        RETURNING "id"
      `,
      [
        row.id,
        row.googleEventId,
        row.iCalUID,
        row.summary,
        row.eventType,
        row.description,
        row.location,
        row.start,
        row.end,
        row.timezone,
        row.emailSubject,
        row.emailHtml,
        row.organizerEmail,
        row.sequence,
        row.hangoutLink,
        row.reminderMinutes,
        row.createdAt,
        row.updatedAt,
      ],
    );

    let targetId = inserted.rows[0]?.id;
    if (!targetId) {
      const existing = await client.query(
        `SELECT "id" FROM "Event" WHERE "iCalUID" = $1`,
        [row.iCalUID],
      );
      targetId = existing.rows[0]?.id;
    }

    if (!targetId) {
      throw new Error(`Could not resolve target event for ${row.iCalUID}`);
    }
    eventIdMap.set(row.id, targetId);
  }

  for (const row of source.attendees) {
    const targetEventId = eventIdMap.get(row.eventId);
    if (!targetEventId) {
      throw new Error(`Missing event mapping for attendee ${row.id}`);
    }

    await client.query(
      `
        INSERT INTO "Attendee"
          ("id", "eventId", "email", "name", "type", "rsvp", "respondedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `,
      [
        row.id,
        targetEventId,
        row.email,
        row.name,
        row.type,
        row.rsvp,
        row.respondedAt,
      ],
    );
  }

  for (const row of source.rsvpLogs) {
    const targetEventId = eventIdMap.get(row.eventId) ?? row.eventId;
    await client.query(
      `
        INSERT INTO "RsvpTokenLog"
          ("id", "token", "eventId", "attendeeEmail", "action", "dedupeKey", "receivedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `,
      [
        row.id,
        row.token,
        targetEventId,
        row.attendeeEmail,
        row.action,
        row.dedupeKey,
        row.receivedAt,
      ],
    );
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

console.log("SQLite to PostgreSQL migration completed.");
console.log(`Events: ${source.events.length}`);
console.log(`Attendees: ${source.attendees.length}`);
console.log(`Organizer accounts: ${source.organizers.length}`);
console.log(`RSVP logs: ${source.rsvpLogs.length}`);
