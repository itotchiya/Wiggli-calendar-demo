import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed demo data.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const demoEvents = [
  {
    iCalUID: "demo-ethan-interview@wiggli.local",
    summary: "Interview with Ethan Patel | Sr Digital Marketer",
    eventType: "Interview",
    description: "Discuss Ethan's growth-marketing experience, campaign ownership, and approach to international acquisition.",
    location: "Paris HQ — 12 Rue de la Paix, 75002 Paris",
    start: new Date("2026-09-01T09:30:00.000Z"),
    end: new Date("2026-09-01T10:00:00.000Z"),
    previewData: {
      organizerName: "Kai Zeller",
      organizerAvatar: "/avatars/avatar-24.webp",
      attendeeAvatars: {
        "ethan.patel@example.com": "/avatars/avatar-4.webp",
        "emily.carter@example.com": "/avatars/avatar-22.webp",
        "james.whitaker@example.com": "/avatars/avatar-19.webp",
        "david.park@example.com": "/avatars/avatar-24.webp",
        "victoria.sterling@example.com": "/avatars/avatar-18.webp",
        "maya.singh@example.com": "/avatars/avatar-9.webp",
      },
      linkedTo: [
        { type: "Candidate", label: "Ethan Patel", avatar: "/avatars/avatar-4.webp" },
        { type: "Contact", label: "James Whitaker", avatar: "/avatars/avatar-19.webp" },
        { type: "Organization", label: "General Motors" },
        { type: "Opportunity", label: "New development team" },
        { type: "Job", label: "2401 - VP of Global Equity" },
      ],
      locations: [
        { label: "Paris HQ — 12 Rue de la Paix, 75002 Paris", type: "Company office" },
        { label: "Brussels Office — 45 Avenue Louise, 1050 Brussels", type: "Another location" },
      ],
      meetingLinks: [
        { provider: "Wiggli", url: "https://app.wiggli.io/events/xyz123abc" },
        { provider: "Zoom", url: "https://zoom.us/j/123456789" },
        { provider: "Google Meet", url: "https://meet.google.com/abc-defg-hij" },
        { provider: "Microsoft Teams", url: "https://teams.live.com/as4z34tt" },
        { provider: "Custom", url: "https://custommeetings.com/demo123" },
      ],
    },
    attendees: [
      { email: "ethan.patel@example.com", name: "Ethan Patel", type: "candidate", rsvp: "NEEDS_ACTION" },
      { email: "emily.carter@example.com", name: "Emily Carter", type: "internal", rsvp: "ACCEPTED" },
      { email: "james.whitaker@example.com", name: "James Whitaker", type: "contact", rsvp: "DECLINED" },
      { email: "david.park@example.com", name: "David Park", type: "internal", rsvp: "TENTATIVE" },
      { email: "victoria.sterling@example.com", name: "Victoria Sterling", type: "contact", rsvp: "NEEDS_ACTION" },
      { email: "maya.singh@example.com", name: "Maya Singh", type: "freelancer", rsvp: "ACCEPTED" },
    ],
  },
  {
    iCalUID: "demo-maya-portfolio@wiggli.local",
    summary: "Portfolio review with Maya Singh",
    eventType: "Freelancer interview",
    description: "Review selected product work and discuss the frontend redesign engagement.",
    location: "https://meet.google.com/maya-demo-room",
    start: new Date("2026-09-02T13:00:00.000Z"),
    end: new Date("2026-09-02T13:45:00.000Z"),
    previewData: {
      organizerName: "Kai Zeller",
      organizerAvatar: "/avatars/avatar-24.webp",
      attendeeAvatars: { "maya.singh@example.com": "/avatars/avatar-9.webp" },
      linkedTo: [
        { type: "Candidate", label: "Maya Singh", avatar: "/avatars/avatar-9.webp" },
        { type: "Job", label: "Frontend developer" },
        { type: "Organization", label: "Nova Systems" },
      ],
      locations: [],
      meetingLinks: [{ provider: "Google Meet", url: "https://meet.google.com/maya-demo-room" }],
    },
    attendees: [{ email: "maya.singh@example.com", name: "Maya Singh", type: "freelancer", rsvp: "NEEDS_ACTION" }],
  },
  {
    iCalUID: "demo-james-partner-review@wiggli.local",
    summary: "Partner review with James Whitaker",
    eventType: "Meeting",
    description: "Quarterly partner review covering open opportunities and upcoming hiring plans.",
    location: "Brussels Office — 45 Avenue Louise, 1050 Brussels",
    start: new Date("2026-09-03T10:00:00.000Z"),
    end: new Date("2026-09-03T10:30:00.000Z"),
    previewData: {
      organizerName: "Kai Zeller",
      organizerAvatar: "/avatars/avatar-24.webp",
      attendeeAvatars: { "james.whitaker@example.com": "/avatars/avatar-19.webp" },
      linkedTo: [
        { type: "Contact", label: "James Whitaker", avatar: "/avatars/avatar-19.webp" },
        { type: "Organization", label: "General Motors" },
        { type: "Opportunity", label: "Engineering recruitment" },
      ],
      locations: [{ label: "Brussels Office — 45 Avenue Louise, 1050 Brussels", type: "Company office" }],
      meetingLinks: [],
    },
    attendees: [{ email: "james.whitaker@example.com", name: "James Whitaker", type: "contact", rsvp: "ACCEPTED" }],
  },
];

async function main() {
  for (const event of demoEvents) {
    await db.event.upsert({
      where: { iCalUID: event.iCalUID },
      update: {
        summary: event.summary,
        eventType: event.eventType,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        previewData: event.previewData,
        attendees: { deleteMany: {}, create: event.attendees.map((attendee) => ({ ...attendee })) },
      },
      create: {
        iCalUID: event.iCalUID,
        googleEventId: null,
        summary: event.summary,
        eventType: event.eventType,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        timezone: "Africa/Casablanca",
        organizerEmail: "kai.zeller@example.com",
        reminderMinutes: 15,
        previewData: event.previewData,
        attendees: { create: event.attendees.map((attendee) => ({ ...attendee })) },
      },
    });
  }
  console.log(`Seeded ${demoEvents.length} realistic calendar events.`);
}

main().finally(async () => db.$disconnect());
