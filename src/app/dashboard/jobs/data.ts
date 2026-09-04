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
      { id: "c1", initials: "TT", name: "Tuan Tuan Abdullah", role: "Backend Development", date: "25/06/2026", match: 68, color: "#d64560" },
      { id: "c2", initials: "YG", name: "Yevgen Grechko", role: "Full-Stack Development", date: "23/06/2026", match: 77, color: "#8b5cf6" },
      { id: "c3", initials: "HH", name: "Hicham Hassan", role: "Frontend Development", date: "23/06/2026", match: 82, color: "#e58bb0" },
      { id: "c4", initials: "KE", name: "Karim El Fassi", date: "23/06/2026", match: 84, color: "#1e9e6a" },
    ],
  },
  {
    id: "candidate-review",
    label: "Candidate review",
    candidates: [
      { id: "c5", initials: "OO", name: "Olayiwola O Omitola", role: "Frontend Development", date: "23/06/2026", match: 74, color: "#5b9bd5" },
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

export const candidateRows: CandidateListRow[] = [
  { id: "89949590", firstName: "serena", lastName: "El Amrani", workType: "Permanent", jobTitle: "—", email: "serena.elamrani@inc.be", phone: "—", externalProfile: "—", employmentType: "permanent", residence: "—", extraBenefits: "—", category: "—", subCategory: "—", functions: "—", seniority: "—", skills: "—", languages: "—", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: false },
  { id: "89949589", firstName: "robert", lastName: "D", workType: "Permanent", jobTitle: "Compliance Assistant", email: "robert.d@inc.com", phone: "NL +316****3377", externalProfile: "—", employmentType: "permanent", residence: "—", extraBenefits: "—", category: "Compliance & Regulatory", subCategory: "Compliance Management", functions: "Export/Import Compliance", seniority: "junior", skills: "—", languages: "—", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949588", firstName: "salma", lastName: "addan", workType: "Permanent", jobTitle: "—", email: "salma.addan@gmail.com", phone: "NL +316****3378", externalProfile: "—", employmentType: "permanent", residence: "—", extraBenefits: "—", category: "—", subCategory: "—", functions: "—", seniority: "—", skills: "—", languages: "—", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: false },
  { id: "89949587", firstName: "farah", lastName: "faraj", workType: "Hybrid", jobTitle: "—", email: "fara.faraj@gmail.com", phone: "NL +316****3377", externalProfile: "—", employmentType: "permanent", residence: "—", extraBenefits: "—", category: "—", subCategory: "—", functions: "—", seniority: "—", skills: "—", languages: "—", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: false },
  { id: "89949582", firstName: "Amine", lastName: "Ouaziz", workType: "Freelance", jobTitle: "Embedded Software Engineer", email: "—", phone: "—", externalProfile: "—", employmentType: "—", residence: "Casablanca, Morocco", extraBenefits: "Java", category: "ICT (+1)", subCategory: "Software Development", functions: "Embedded Systems Development", seniority: "medior (+1)", skills: "Python 4/5; Agile Methodologies 4/5; Unit Testing", languages: "Arabic 5/5; English 4/5; French 4/5", notes: "No", lastNote: "—", yearsExperience: "4 years", companies: "Vitesco Technologies", schools: "Faculté Des Sciences Et", degree: "Master's; Bachelor's", hasLinkedJob: true },
  { id: "89949328", firstName: "hussain", lastName: "ahmed", workType: "Permanent", jobTitle: "Senior Backend Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "—", residence: "Pakistan", extraBenefits: "Java", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "PHP 5/5; CodeIgniter 5/5; Laravel 5/5; Java", languages: "English 3/5", notes: "No", lastNote: "—", yearsExperience: "6 years", companies: "Emtiyaz Soft; PixelSoft", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949230", firstName: "hitesh", lastName: "kumar", workType: "Permanent", jobTitle: "Backend Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Kitchener, Canada", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "Python 3/5; JavaScript 3/5; TypeScript 3/5", languages: "English 4/5", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949200", firstName: "aleksey", lastName: "zhylko", workType: "Permanent", jobTitle: "Senior PHP Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Kyiv, Ukraine", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "PHP 5/5; Laravel 4/5; Symfony 3/5; MySQL", languages: "English 4/5; Russian 4/5", notes: "No", lastNote: "—", yearsExperience: "6 years", companies: "Sportlabs Group; Vseos", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949422", firstName: "oleksandr", lastName: "t", workType: "Permanent", jobTitle: "Full-Stack Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Ukraine", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Full-Stack Development", seniority: "senior", skills: "PHP 5/5; JavaScript 4/5; SQL 4/5; MySQL 4/5", languages: "English 4/5; Ukrainian 5/5", notes: "Yes", lastNote: "OVERALL ASSESSMENT", yearsExperience: "4 years", companies: "LABELPLATFORM; NEW", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949385", firstName: "tuan", lastName: "tuan abdullah", workType: "—", jobTitle: "—", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Malaysia", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "Python 4/5; Java 4/5; JavaScript 4/5; React", languages: "English 4/5", notes: "Yes", lastNote: "OVERALL ASSESSMENT", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: false },
  { id: "89949245", firstName: "nikol", lastName: "paraskova", workType: "Permanent", jobTitle: "Junior Backend Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Sofia, Bulgaria", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "junior", skills: "PHP 5/5; MySQL 4/5; CSS 3/5; HTML 3/5", languages: "English 4/5; Bulgarian 5/5; German 1/5", notes: "Yes", lastNote: "test", yearsExperience: "1 years", companies: "Pontica Solutions; Trad", schools: "University of Lincoln", degree: "Master of Science; Bachelor's", hasLinkedJob: true },
  { id: "89949560", firstName: "Radouane", lastName: "Ouledmoussa", workType: "Permanent", jobTitle: "Senior Java Developer", email: "—", phone: "—", externalProfile: "—", employmentType: "permanent", residence: "Morocco", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "Java 5/5; Spring Boot 4/5; Jenkins 4/5; Oracle", languages: "Arabic 5/5; French 5/5; English 4/5; German", notes: "Yes", lastNote: "OVERALL ASSESSMENT", yearsExperience: "14 years", companies: "Java Community Process", schools: "Institut Supérieur De Gé", degree: "Multimedia Avionics", hasLinkedJob: true },
];

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
