/** AI Notetaker test seed — one Interview event with rich linked-record JSON.
 * The notetaker context packet reads previewData.linkedTo[].details as ground truth
 * (job description, candidate profile, org / opportunity / contact info).
 * Idempotent: re-run safely. Run: npx tsx prisma/seed-ai-notetaker.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed demo data.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SEED_UID = "ai-notetaker-test-interview@wiggli.local";

async function main(): Promise<void> {
  // Tomorrow 10:00–10:30 Europe/Paris (CEST = UTC+2 in September).
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(8, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  await db.event.deleteMany({ where: { iCalUID: SEED_UID } });

  const event = await db.event.create({
    data: {
      iCalUID: SEED_UID,
      source: "WIGGLI",
      summary: "Hiring Manager Interview | Alex Money x Senior Product Designer",
      eventType: "Interview",
      description:
        "Hiring-manager round for the Senior Product Designer role at Acme Corp. Focus: systems thinking, stakeholder management, and growth-mindset signals.",
      location: "Google Meet (test link added at meeting time)",
      start,
      end,
      timezone: "Europe/Paris",
      organizerEmail: "luxqoox@gmail.com",
      status: "SCHEDULED",
      previewData: {
        organizerName: "Lux Qoox",
        attendeeAvatars: {},
        linkedTo: [
          {
            type: "Job",
            label: "Senior Product Designer",
            details: {
              title: "Senior Product Designer",
              company: "Acme Corp",
              location: "Brussels (hybrid, 2 days on-site)",
              salaryRange: "€65k–€75k",
              description:
                "Own end-to-end design for Acme's billing and subscription flows. Partner with product and engineering in a squad of six. Raise the bar on design systems and mentor one mid-level designer.",
              requirements: [
                "5+ years product design experience, ideally SaaS",
                "Strong portfolio of shipped checkout or billing flows",
                "Systems thinking: tokens, components, documentation",
                "Stakeholder management with product + engineering",
              ],
              niceToHave: ["Motion design", "Growth experimentation", "Dutch or French fluency"],
              hiringManager: "Lux Qoox",
            },
          },
          {
            type: "Candidate",
            label: "Alex Money",
            details: {
              name: "Alex Money",
              headline: "Product Designer, 6 years, fintech + SaaS",
              experience: [
                "Senior Product Designer @ Payline (2022–now): redesigned checkout, +11% conversion",
                "Product Designer @ Booksy (2020–2022): design system contributor",
              ],
              skills: ["Figma", "Design systems", "Prototyping", "User interviews", "A/B testing"],
              languages: ["English (fluent)", "French (native)"],
              availability: "1-month notice period",
              salaryExpectation: "around €72k",
              motivation: "Wants larger scope and mentorship responsibility",
            },
          },
          {
            type: "Organization",
            label: "Acme Corp",
            details: {
              name: "Acme Corp",
              industry: "B2B SaaS billing",
              size: "120 employees",
              location: "Brussels",
              context: "Scaling the billing squad; design-system debt is the main bottleneck.",
            },
          },
          {
            type: "Opportunity",
            label: "Billing squad expansion Q3",
            details: {
              title: "Billing squad expansion Q3",
              stage: "Hiring-manager interview",
              notes: "Backfill + one net-new seat. Decision needed before end of September.",
            },
          },
          {
            type: "Contact",
            label: "Sam Boufous",
            details: {
              name: "Sam Boufous",
              role: "External design consultant (reference)",
              relationship: "Managed the candidate on a freelance engagement in 2024",
            },
          },
        ],
        locations: [],
        meetingLinks: [],
      },
      attendees: {
        create: [
          { email: "linksomoney@gmail.com", name: "Alex Money", type: "candidate" },
          { email: "must.boufous@outlook.com", name: "Sam Boufous", type: "contact" },
          { email: "must.boufous@gmail.com", name: "Mustapha Boufous", type: "internal" },
        ],
      },
    },
    include: { attendees: true },
  });

  console.log(`Seeded test event ${event.id} (${event.summary}) with ${event.attendees.length} attendees.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void db.$disconnect());
