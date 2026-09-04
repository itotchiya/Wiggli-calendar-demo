/**
 * Shared attendee directory — single source of truth for candidates across the
 * EventDrawer (invitations), pipeline board, and candidates pages.
 * Moving a candidate here keeps their name, email, avatar, and linked jobs
 * identical everywhere.
 */

export type AttendeeType = "candidate" | "contact" | "internal";

export type LinkedContext = {
  id: string;
  kind: "job" | "opportunity";
  title: string;
  contract: "Permanent" | "Temporary";
  organizationId: string;
  organization: string;
  organizationInitials: string;
};

export type AttendeeSchedule = { status: "Busy" | "Out of Office" | "Awaiting response" | "Confirmed"; date: string; time?: string };

export type AttendeePerson = {
  id: string;
  name: string;
  email: string;
  type: AttendeeType;
  avatar: string;
  links?: LinkedContext[];
  organizations?: string[];
  schedules?: AttendeeSchedule[];
  locked?: boolean;
};

export const TEST_EMAILS = [
  "linksomoney@gmail.com",
  "luxqoox@gmail.com",
  "must.boufous@gmail.com",
  "must-boufous@outlook.com",
  "mustapha@wiggli.io",
] as const;

export const organizations: Record<string, { id: string; name: string; initials: string; relationship: "Holding" | "Subsidiary" }> = {
  gm: { id: "gm", name: "General Motors", initials: "GM", relationship: "Holding" },
  nova: { id: "nova", name: "Nova Systems", initials: "NS", relationship: "Subsidiary" },
  cobalt: { id: "cobalt", name: "Cobalt Industries", initials: "CI", relationship: "Subsidiary" },
  zephyr: { id: "zephyr", name: "Zephyr Labs", initials: "ZL", relationship: "Subsidiary" },
  "jacquet-scrl": { id: "jacquet-scrl", name: "Jacquet SCRL", initials: "JS", relationship: "Holding" },
};

export const linkedContexts: Record<string, LinkedContext> = {
  frontend: { id: "frontend", kind: "job", title: "Frontend developer", contract: "Permanent", organizationId: "gm", organization: "General Motors", organizationInitials: "GM" },
  backend: { id: "backend", kind: "job", title: "Backend developer", contract: "Temporary", organizationId: "gm", organization: "General Motors", organizationInitials: "GM" },
  engineering: { id: "engineering", kind: "opportunity", title: "Engineering recruitment", contract: "Permanent", organizationId: "gm", organization: "General Motors", organizationInitials: "GM" },
  development: { id: "development", kind: "opportunity", title: "New development team", contract: "Temporary", organizationId: "gm", organization: "General Motors", organizationInitials: "GM" },
  novaFrontend: { id: "nova-frontend", kind: "job", title: "Product frontend engineer", contract: "Permanent", organizationId: "nova", organization: "Nova Systems", organizationInitials: "NS" },
  novaPlatform: { id: "nova-platform", kind: "opportunity", title: "Platform expansion", contract: "Temporary", organizationId: "nova", organization: "Nova Systems", organizationInitials: "NS" },
  cobaltDesign: { id: "cobalt-design", kind: "job", title: "Product designer", contract: "Permanent", organizationId: "cobalt", organization: "Cobalt Industries", organizationInitials: "CI" },
  zephyrResearch: { id: "zephyr-research", kind: "opportunity", title: "Research partnership", contract: "Temporary", organizationId: "zephyr", organization: "Zephyr Labs", organizationInitials: "ZL" },
  jacquetRND: { id: "jacquet-rnd", kind: "job", title: "R&D Chimistry", contract: "Permanent", organizationId: "jacquet-scrl", organization: "Jacquet SCRL", organizationInitials: "JS" },
};

export const candidateLinks: Record<string, LinkedContext[]> = {
  "linksomoney": [linkedContexts.frontend],
  "luxqoox-candidate": [linkedContexts.backend],
  "ava-thompson": [linkedContexts.frontend],
  "ethan-patel": [linkedContexts.frontend, linkedContexts.backend, linkedContexts.engineering, linkedContexts.development],
  "sofia-morales": [linkedContexts.frontend, linkedContexts.novaFrontend, linkedContexts.novaPlatform],
  "jamal-washington": [],
  "linh-nguyen": [linkedContexts.engineering],
  "oliver-schmidt": [linkedContexts.backend, linkedContexts.development],
  "nadia-benali": [linkedContexts.cobaltDesign, linkedContexts.zephyrResearch],
  "lucas-martin": [linkedContexts.backend, linkedContexts.engineering],
};

/**
 * Candidate roster used by the EventDrawer attendee picker AND the ATS pages.
 * Emails are stable (not random) so list, drawer, and sent invitations agree.
 */
export const candidateDirectory: AttendeePerson[] = [
  { id: "linksomoney", name: "Links Omoney", email: TEST_EMAILS[0], type: "candidate", avatar: "/avatars/avatar-1.webp", links: candidateLinks["linksomoney"] },
  // Keep one stable Outlook recipient available for calendar sync testing.
  { id: "luxqoox-candidate", name: "Lux Qoox", email: "must-boufous@outlook.com", type: "candidate", avatar: "/avatars/avatar-2.webp", links: candidateLinks["luxqoox-candidate"] },
  { id: "ava-thompson", name: "Ava Thompson", email: TEST_EMAILS[1], type: "candidate", avatar: "/avatars/avatar-3.webp", links: candidateLinks["ava-thompson"] },
  { id: "ethan-patel", name: "Ethan Patel", email: TEST_EMAILS[2], type: "candidate", avatar: "/avatars/avatar-4.webp", links: candidateLinks["ethan-patel"] },
  { id: "sofia-morales", name: "Sofia Morales", email: TEST_EMAILS[3], type: "candidate", avatar: "/avatars/avatar-5.webp", links: candidateLinks["sofia-morales"] },
  { id: "jamal-washington", name: "Jamal Washington", email: TEST_EMAILS[4], type: "candidate", avatar: "/avatars/avatar-6.webp", links: candidateLinks["jamal-washington"] },
  { id: "linh-nguyen", name: "Linh Nguyen", email: TEST_EMAILS[0], type: "candidate", avatar: "/avatars/avatar-7.webp", links: candidateLinks["linh-nguyen"] },
  { id: "oliver-schmidt", name: "Oliver Schmidt", email: TEST_EMAILS[1], type: "candidate", avatar: "/avatars/avatar-8.webp", links: candidateLinks["oliver-schmidt"] },
  { id: "nadia-benali", name: "Nadia Benali", email: TEST_EMAILS[2], type: "candidate", avatar: "/avatars/avatar-9.webp", links: candidateLinks["nadia-benali"] },
  { id: "lucas-martin", name: "Lucas Martin", email: TEST_EMAILS[3], type: "candidate", avatar: "/avatars/avatar-10.webp", links: candidateLinks["lucas-martin"] },
];

/** Role label for a candidate = their first linked job/opportunity title. */
export function candidateRole(id: string): string | undefined {
  return candidateLinks[id]?.[0]?.title;
}
