import { candidateDirectory } from "@/lib/attendee-directory";

export type JobRow = {
  reference: number;
  title: string;
  type: "Temporary" | "Permanent";
  site: string;
  department: string;
  category: string;
  subCategory: string;
};

export const jobs: JobRow[] = [
  { reference: 1628, title: "r&d chimistry", type: "Temporary", site: "Jacquet SCRL", department: "ICT", category: "Compliance & Regulations", subCategory: "Audit & Compliance" },
  { reference: 1627, title: "responsable r&d (H/F)", type: "Temporary", site: "Jacquet SCRL", department: "ICT", category: "Compliance & Regulations", subCategory: "Audit & Compliance" },
  { reference: 1614, title: "testing crm job", type: "Temporary", site: "Jacquet SCRL", department: "FINANCE", category: "Construction & Real Estate", subCategory: "Construction" },
  { reference: 1607, title: "Job title", type: "Permanent", site: "Jacquet SCRL", department: "ICT", category: "Business Administration", subCategory: "Document Management" },
  { reference: 1597, title: "Frontend Developer 4", type: "Permanent", site: "Jacquet SCRL", department: "ICT", category: "ICT", subCategory: "Software Development" },
  { reference: 1596, title: "product designer ux", type: "Permanent", site: "Jacquet SCRL", department: "FINANCE", category: "Compliance & Regulations", subCategory: "Compliance" },
  { reference: 1594, title: "frontend developer", type: "Permanent", site: "—", department: "—", category: "—", subCategory: "—" },
  { reference: 1567, title: "product designer ux", type: "Permanent", site: "Jacquet SCRL", department: "FINANCE", category: "Compliance & Regulations", subCategory: "Compliance" },
  { reference: 1553, title: "Senior python developer", type: "Permanent", site: "Jacquet SCRL", department: "MARKETING", category: "Engineering", subCategory: "Automation" },
];

export function findJob(reference: number): JobRow {
  return jobs.find((job) => job.reference === reference) ?? jobs[4];
}

export type PipelineCandidate = {
  id: string;
  initials: string;
  name: string;
  role?: string;
  date: string;
  match: number;
  color: string;
};

export type PipelineStage = {
  id: string;
  label: string;
  candidates: PipelineCandidate[];
};

export const pipelineStages: PipelineStage[] = [
  { id: "applications", label: "Applications", candidates: [] },
  {
    id: "sourced",
    label: "Sourced",
    candidates: [
      { id: "ethan-patel", initials: "EP", name: "Ethan Patel", role: "Frontend developer", date: "25/06/2026", match: 68, color: "#d64560" },
      { id: "oliver-schmidt", initials: "OS", name: "Oliver Schmidt", role: "Backend developer", date: "23/06/2026", match: 77, color: "#8b5cf6" },
      { id: "sofia-morales", initials: "SM", name: "Sofia Morales", role: "Product frontend engineer", date: "23/06/2026", match: 82, color: "#e58bb0" },
      { id: "jamal-washington", initials: "JW", name: "Jamal Washington", date: "23/06/2026", match: 84, color: "#1e9e6a" },
    ],
  },
  {
    id: "candidate-review",
    label: "Candidate review",
    candidates: [
      { id: "linh-nguyen", initials: "LN", name: "Linh Nguyen", role: "Engineering recruitment", date: "23/06/2026", match: 74, color: "#5b9bd5" },
    ],
  },
  { id: "interview", label: "Interview", candidates: [] },
  { id: "phone-screening", label: "Phone screening", candidates: [] },
  { id: "offer", label: "Offer", candidates: [] },
  { id: "new-step-interview", label: "New step interview", candidates: [] },
];

export type CandidateListRow = {
  id: string;
  firstName: string;
  lastName: string;
  workType: string;
  email: string;
  phone: string;
  hasLinkedJob: boolean;
  jobTitle?: string;
  externalProfile: string;
  employmentType: string;
  residence: string;
  extraBenefits: string;
  category: string;
  subCategory: string;
  functions: string;
  seniority: string;
  skills: string;
  languages: string;
  notes: string;
  lastNote: string;
  yearsExperience: string;
  companies: string;
  schools: string;
  degree: string;
};

/**
 * Candidates page list — derived from the SHARED attendee directory
 * (`src/lib/attendee-directory.ts`) so the drawer, pipeline, and this table all
 * show the same people with the same invitation emails. Extra profile fields
 * are presentation-only garnish; identity (name/email/avatar) comes from the
 * directory.
 */
const candidateGarnish: Record<string, Partial<CandidateListRow>> = {
  "ethan-patel": { phone: "NL +316****3377", residence: "Brussels, Belgium", functions: "Frontend Development", seniority: "senior", skills: "React 5/5; TypeScript 4/5; CSS 4/5", languages: "English 5/5; French 4/5", yearsExperience: "6 years" },
  "oliver-schmidt": { phone: "DE +4915****8821", residence: "Berlin, Germany", functions: "Backend Development", seniority: "senior", skills: "Node.js 5/5; PostgreSQL 4/5; GraphQL 4/5", languages: "English 5/5; German 5/5", yearsExperience: "7 years" },
  "sofia-morales": { phone: "ES +346****4402", residence: "Madrid, Spain", functions: "Frontend Development", seniority: "medior", skills: "Vue 4/5; JavaScript 4/5; Accessibility 3/5", languages: "Spanish 5/5; English 4/5", yearsExperience: "4 years" },
  "jamal-washington": { externalProfile: "—", residence: "Chicago, USA", workType: "Hybrid" },
  "linh-nguyen": { phone: "VN +84***2201", residence: "Ho Chi Minh City, Vietnam", functions: "Full-Stack Development", seniority: "medior", skills: "TypeScript 4/5; React 4/5; Node.js 3/5", languages: "English 4/5; Vietnamese 5/5", yearsExperience: "3 years" },
  "ava-thompson": { phone: "UK +44****912", residence: "Manchester, UK", functions: "Product Design", seniority: "senior", skills: "Figma 5/5; Design Systems 4/5", languages: "English 5/5", yearsExperience: "5 years" },
  "linksomoney": { externalProfile: "—", residence: "Antwerp, Belgium" },
  "luxqoox-candidate": { externalProfile: "—", residence: "Brussels, Belgium", workType: "Freelance" },
  "nadia-benali": { phone: "MA +212***558", residence: "Casablanca, Morocco", functions: "Product Design", seniority: "medior", skills: "Figma 4/5; Prototyping 4/5; Research 3/5", languages: "Arabic 5/5; French 5/5; English 4/5", yearsExperience: "4 years" },
  "lucas-martin": { phone: "FR +337****6120", residence: "Lyon, France", functions: "Backend Development", seniority: "junior", skills: "Python 3/5; Django 3/5", languages: "French 5/5; English 4/5", yearsExperience: "2 years" },
};

export const candidateRows: CandidateListRow[] = candidateDirectory.map((person, index) => {
  const [firstName, ...rest] = person.name.split(" ");
  const lastName = rest.join(" ") || "—";
  const garnish = candidateGarnish[person.id] ?? {};
  return {
    id: person.id,
    firstName,
    lastName,
    workType: garnish.workType ?? "Permanent",
    email: person.email, // identical to what the drawer invites
    phone: garnish.phone ?? "—",
    hasLinkedJob: (person.links?.length ?? 0) > 0,
    jobTitle: person.links?.[0]?.title ?? "—",
    externalProfile: garnish.externalProfile ?? "LinkedIn profile",
    employmentType: "permanent",
    residence: garnish.residence ?? "—",
    extraBenefits: "—",
    category: garnish.category ?? "ICT",
    subCategory: garnish.subCategory ?? "Software Development",
    functions: garnish.functions ?? "—",
    seniority: garnish.seniority ?? "—",
    skills: garnish.skills ?? "—",
    languages: garnish.languages ?? "—",
    notes: "No",
    lastNote: "—",
    yearsExperience: garnish.yearsExperience ?? "—",
    companies: "—",
    schools: "—",
    degree: "—",
  };
});

export function findCandidate(id: string): CandidateListRow {
  return candidateRows.find((c) => c.id === id) ?? {
    id, firstName: "Candidate", lastName: id, workType: "Permanent", email: "candidate@example.com", phone: "—",
    externalProfile: "—", employmentType: "—", residence: "—", extraBenefits: "—", category: "—", subCategory: "—",
    functions: "—", seniority: "—", skills: "—", languages: "—", notes: "No", lastNote: "—", yearsExperience: "—",
    companies: "—", schools: "—", degree: "—", hasLinkedJob: false,
  };
}

export type JobMeetingRow = {
  id: number;
  candidateName: string;
  jobTitle: string;
  type: "Meeting" | "Call" | "Interview" | "Job intake";
  status: "Interview Overdue" | "Interview Completed" | "Scheduled" | "Completed";
  subjectRole?: "Candidate" | "Contact";
  organization: string;
  organizer: string;
  workType: string;
  attendees: { name: string; type: "internal" }[];
  interviewDate: string;
  startTime: string;
  endTime: string;
  duration: string;
  locationType: "Online" | "Company address";
  location: string;
  meetingLink: string;
  reminder: string;
  createdOn: string;
};

export type InterviewRow = JobMeetingRow & { type: "Interview"; status: "Interview Overdue" | "Interview Completed" };

export const interviews: InterviewRow[] = [
  { id: 4, candidateName: "serena El Amrani", jobTitle: "r&d chimistry", type: "Interview", status: "Interview Completed", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "Permanent", attendees: [{ name: "Axelle Bastin", type: "internal" }, { name: "Emily Carter", type: "internal" }], interviewDate: "14/08/2026", startTime: "11:00", endTime: "11:45", duration: "45 min", locationType: "Online", location: "Wiggli Meet", meetingLink: "https://meet.wiggli.com/interview/serena-el-amrani", reminder: "15 minutes", createdOn: "08/08/2026" },
  { id: 1, candidateName: "YANN MULLER", jobTitle: "Backend developer", type: "Interview", status: "Interview Overdue", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "—", attendees: [{ name: "Axelle Bastin", type: "internal" }, { name: "David Park", type: "internal" }], interviewDate: "11/08/2026", startTime: "10:00", endTime: "10:45", duration: "45 min", locationType: "Online", location: "Wiggli Meet", meetingLink: "https://meet.wiggli.com/interview/yann-muller", reminder: "15 minutes", createdOn: "04/08/2026" },
  { id: 2, candidateName: "Sébastien GIESBERGEN", jobTitle: "Backend developer", type: "Interview", status: "Interview Completed", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "Freelance", attendees: [{ name: "Axelle Bastin", type: "internal" }], interviewDate: "07/08/2026", startTime: "14:00", endTime: "15:00", duration: "1h", locationType: "Company address", location: "Brussels Office", meetingLink: "", reminder: "30 minutes", createdOn: "01/08/2026" },
  { id: 3, candidateName: "Hicham hassan", jobTitle: "Redux Developer", type: "Interview", status: "Interview Overdue", organization: "Nova Systems", organizer: "Axelle Bastin", workType: "Permanent", attendees: [{ name: "Axelle Bastin", type: "internal" }, { name: "Sarah Jenkins", type: "internal" }], interviewDate: "29/07/2026", startTime: "09:30", endTime: "10:15", duration: "45 min", locationType: "Online", location: "Microsoft Teams", meetingLink: "https://teams.microsoft.com/l/meetup-join/hicham-hassan", reminder: "15 minutes", createdOn: "22/07/2026" },
];

export const jobMeetings: JobMeetingRow[] = [
  ...interviews,
  { id: 5, candidateName: "serena El Amrani", jobTitle: "r&d chimistry", type: "Meeting", status: "Scheduled", subjectRole: "Candidate", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "Permanent", attendees: [{ name: "Axelle Bastin", type: "internal" }], interviewDate: "18/08/2026", startTime: "14:00", endTime: "14:30", duration: "30 min", locationType: "Online", location: "Google Meet", meetingLink: "https://meet.google.com/serena-candidate-meeting", reminder: "15 minutes", createdOn: "15/08/2026" },
  { id: 6, candidateName: "Victoria Sterling", jobTitle: "r&d chimistry", type: "Meeting", status: "Scheduled", subjectRole: "Contact", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "—", attendees: [{ name: "David Park", type: "internal" }, { name: "Emily Carter", type: "internal" }], interviewDate: "20/08/2026", startTime: "10:30", endTime: "11:15", duration: "45 min", locationType: "Company address", location: "Brussels Office", meetingLink: "", reminder: "30 minutes", createdOn: "16/08/2026" },
];
