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

export type CandidateRow = {
  id: number;
  name: string;
  jobTitle: string;
  status: "Sourced" | "Rejected";
  applicationType: string;
  workType: string;
  source: string;
  sourcedBy: string;
  appliedOn: string;
};

export const candidates: CandidateRow[] = [
  { id: 1, name: "serena El Amrani", jobTitle: "r&d chimistry", status: "Sourced", applicationType: "Sourced", workType: "Permanent", source: "wiggli talent pool", sourcedBy: "Axelle Bastin", appliedOn: "03/06/2026" },
  { id: 2, name: "robert D", jobTitle: "Job title", status: "Sourced", applicationType: "Sourced", workType: "Permanent", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "27/05/2026" },
  { id: 3, name: "farah faraj", jobTitle: "testing crm job", status: "Sourced", applicationType: "Sourced", workType: "Hybrid", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "22/05/2026" },
  { id: 4, name: "Amine Ouaziz", jobTitle: "Frontend eng 2", status: "Sourced", applicationType: "Sourced", workType: "Freelance", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "08/05/2026" },
  { id: 5, name: "tuan tuan abdullah", jobTitle: "Frontend eng 2", status: "Sourced", applicationType: "Sourced", workType: "Freelance", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "08/05/2026" },
  { id: 6, name: "hussain ahmed", jobTitle: "Frontend eng 2", status: "Sourced", applicationType: "Sourced", workType: "Permanent", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "08/05/2026" },
  { id: 7, name: "oleksandr t", jobTitle: "Frontend eng 2", status: "Sourced", applicationType: "Sourced", workType: "Permanent", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "08/05/2026" },
  { id: 8, name: "hitesh kumar", jobTitle: "Frontend eng 2", status: "Sourced", applicationType: "Sourced", workType: "Permanent", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "08/05/2026" },
  { id: 9, name: "aleksey zhylko", jobTitle: "Frontend eng 2", status: "Sourced", applicationType: "Sourced", workType: "Permanent", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "08/05/2026" },
  { id: 10, name: "tuan tuan abdullah", jobTitle: "Frontend Developer 4", status: "Sourced", applicationType: "Sourced", workType: "Freelance", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "25/04/2026" },
  { id: 11, name: "Sébastien GIESBERGEN", jobTitle: "Senior python developer", status: "Rejected", applicationType: "Sourced", workType: "Freelance", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "24/04/2026" },
  { id: 12, name: "ZAKARIA EL ALAOUI", jobTitle: "Senior python developer", status: "Sourced", applicationType: "Sourced", workType: "Permanent", source: "my candidates", sourcedBy: "Axelle Bastin", appliedOn: "24/04/2026" },
];

export type JobMeetingRow = {
  id: number;
  candidateName: string;
  jobTitle: string;
  type: "Interview" | "Candidate meeting" | "Client meeting";
  status: "Interview Overdue" | "Interview Done" | "Scheduled" | "Completed";
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

export type InterviewRow = JobMeetingRow & { type: "Interview"; status: "Interview Overdue" | "Interview Done" };

export const interviews: InterviewRow[] = [
  { id: 4, candidateName: "serena El Amrani", jobTitle: "r&d chimistry", type: "Interview", status: "Interview Done", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "Permanent", attendees: [{ name: "Axelle Bastin", type: "internal" }, { name: "Emily Carter", type: "internal" }], interviewDate: "14/08/2026", startTime: "11:00", endTime: "11:45", duration: "45 min", locationType: "Online", location: "Wiggli Meet", meetingLink: "https://meet.wiggli.com/interview/serena-el-amrani", reminder: "15 minutes", createdOn: "08/08/2026" },
  { id: 1, candidateName: "YANN MULLER", jobTitle: "Backend developer", type: "Interview", status: "Interview Overdue", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "—", attendees: [{ name: "Axelle Bastin", type: "internal" }, { name: "David Park", type: "internal" }], interviewDate: "11/08/2026", startTime: "10:00", endTime: "10:45", duration: "45 min", locationType: "Online", location: "Wiggli Meet", meetingLink: "https://meet.wiggli.com/interview/yann-muller", reminder: "15 minutes", createdOn: "04/08/2026" },
  { id: 2, candidateName: "Sébastien GIESBERGEN", jobTitle: "Backend developer", type: "Interview", status: "Interview Done", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "Freelance", attendees: [{ name: "Axelle Bastin", type: "internal" }], interviewDate: "07/08/2026", startTime: "14:00", endTime: "15:00", duration: "1h", locationType: "Company address", location: "Brussels Office", meetingLink: "", reminder: "30 minutes", createdOn: "01/08/2026" },
  { id: 3, candidateName: "Hicham hassan", jobTitle: "Redux Developer", type: "Interview", status: "Interview Overdue", organization: "Nova Systems", organizer: "Axelle Bastin", workType: "Permanent", attendees: [{ name: "Axelle Bastin", type: "internal" }, { name: "Sarah Jenkins", type: "internal" }], interviewDate: "29/07/2026", startTime: "09:30", endTime: "10:15", duration: "45 min", locationType: "Online", location: "Microsoft Teams", meetingLink: "https://teams.microsoft.com/l/meetup-join/hicham-hassan", reminder: "15 minutes", createdOn: "22/07/2026" },
];

export const jobMeetings: JobMeetingRow[] = [
  ...interviews,
  { id: 5, candidateName: "serena El Amrani", jobTitle: "r&d chimistry", type: "Candidate meeting", status: "Scheduled", subjectRole: "Candidate", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "Permanent", attendees: [{ name: "Axelle Bastin", type: "internal" }], interviewDate: "18/08/2026", startTime: "14:00", endTime: "14:30", duration: "30 min", locationType: "Online", location: "Google Meet", meetingLink: "https://meet.google.com/serena-candidate-meeting", reminder: "15 minutes", createdOn: "15/08/2026" },
  { id: 6, candidateName: "Victoria Sterling", jobTitle: "r&d chimistry", type: "Client meeting", status: "Scheduled", subjectRole: "Contact", organization: "Jacquet SCRL", organizer: "Axelle Bastin", workType: "—", attendees: [{ name: "David Park", type: "internal" }, { name: "Emily Carter", type: "internal" }], interviewDate: "20/08/2026", startTime: "10:30", endTime: "11:15", duration: "45 min", locationType: "Company address", location: "Brussels Office", meetingLink: "", reminder: "30 minutes", createdOn: "16/08/2026" },
];

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
