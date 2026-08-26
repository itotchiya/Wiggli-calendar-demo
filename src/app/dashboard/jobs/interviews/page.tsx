"use client";

import { Plus } from "lucide-react";
import { useMemo } from "react";
import { Header } from "@/components/chrome";
import { MeetingsTable } from "@/components/crm/meetings-table";
import { interviews } from "../data";
import { JobsPageHeader } from "../ui";

function formatInterviewDate(iso: string) {
  // "14/08/2026" -> "14 Aug 2026"
  const [d,m,y] = iso.split("/");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mm = months[Number(m)-1] ?? "Jan";
  return `${d} ${mm} ${y}`;
}

function statusToMeetingStatus(s: string): "Draft" | "Scheduled" | "Overdue" | "Done" | "Canceled" | "Error" {
  if (s === "Interview Done" || s === "Completed") return "Done";
  if (s === "Interview Overdue") return "Overdue";
  if (s === "Scheduled") return "Scheduled";
  return "Scheduled";
}

export default function JobInterviewsPage() {
  const meetingRows = useMemo(() => interviews.map((iv) => ({
    ref: `MT-${String(iv.id).padStart(6,"0")}`,
    title: `${iv.type} with ${iv.candidateName} | ${iv.jobTitle}`,
    date: `${formatInterviewDate(iv.interviewDate)}, ${iv.startTime} - ${iv.endTime}`,
    status: statusToMeetingStatus(iv.status),
    meetingType: iv.type,
    organizer: { name: iv.organizer, avatar: "", color: "#0f766e" },
    linkedCandidate: { id: iv.candidateName.toLowerCase().replace(/[^a-z0-9]+/g,"-"), name: iv.candidateName, avatar: "" },
    linkedJob: { id: iv.jobTitle.toLowerCase().replace(/[^a-z0-9]+/g,"-"), title: iv.jobTitle },
    linkedOrganization: iv.organization ? { id: iv.organization.toLowerCase().replace(/[^a-z0-9]+/g,"-"), name: iv.organization, initials: iv.organization.slice(0,2).toUpperCase(), color: "#0f766e" } : undefined,
    attendees: iv.attendees.map((a) => ({ name: a.name, avatar: "" })),
    locationType: iv.locationType as any,
    meetingPlace: iv.location,
    meetingPlaceHref: iv.meetingLink || undefined,
    meetingPlaceProvider: (iv.locationType === "Online" ? (iv.location.includes("wiggli") ? "wiggli" : iv.location.includes("teams") ? "teams" : iv.location.includes("google") ? "google" : "zoom") : "company") as any,
    createdOn: iv.createdOn,
    createdBy: { name: iv.organizer, avatar: "" },
    updatedOn: iv.createdOn,
    updatedBy: { name: iv.organizer, avatar: "" },
  })), []);

  return (
    <>
      <Header kicker={<><span className="kicker-muted">Permanent / Jobs / </span>Interviews</>} />
      <main className="jobs-page">
        <JobsPageHeader
          activeTab="Interviews"
          actions={
            <>
              <button className="process-candidates-button" disabled>Process candidates (0)</button>
              <button className="create-job-button"><Plus size={16} /> Create a job</button>
            </>
          }
        />
        <MeetingsTable rows={meetingRows as any} />
      </main>
    </>
  );
}
