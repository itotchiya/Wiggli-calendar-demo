"use client";

import {
  CalendarPlus,
  CircleX,
  FileText,
  Mail,
  MoreHorizontal,
  Send,
  SendHorizontal,
  Star,
} from "lucide-react";
import { useState } from "react";
import { useHighlight } from "@/lib/highlight";
import { Avatar, AvatarStack } from "./ui/avatar";
import { DrawerShell } from "./ui/drawer-shell";
import { usePortalMenu, PortalMenuList, type PortalMenuItem } from "./ui/portal-menu";
import { StatusPill, LocationTypeCell, MeetingPlaceIcon } from "./meetings-table";

type VacancyProgressDrawerProps = {
  open: boolean;
  onClose: () => void;
  vacancyTitle?: string;
  onScheduleInterview?: () => void;
};

const MEETING_COLUMNS = ["Title", "Meeting date & time", "Status", "Meeting type", "Organizer", "Attendees", "Location type", "Meeting place", "Created on", "Created by", "Updated on", "Updated by"];

export function VacancyProgressDrawer({
  open,
  onClose,
  vacancyTitle = "r&d chimistry",
  onScheduleInterview,
}: VacancyProgressDrawerProps) {
  const { has } = useHighlight();
  const shouldHighlight = has("schedule");
  const [activeTab, setActiveTab] = useState("Application details");
  const menu = usePortalMenu();

  const meetingRows = [
    { title: "Interview with Axelle Bastin", date: "29 Aug 2026, 09:00 - 10:00", status: "Scheduled" as const, type: "Interview", organizer: "Axelle Bastin", attendees: ["Axelle Bastin", "Noah Sterling"], locationType: "Company address", place: "avenue Diallo 68 17 / 9 7191 Dilsen-Stokkem Malawi", createdOn: "26/08/2026", createdBy: "Axelle Bastin", updatedOn: "27/08/2026", updatedBy: "Axelle Bastin" },
  ];
  const historyRows = [
    { title: "Interview — round 1", date: "29 Aug 2026, 09:00 - 10:00", status: "Completed" as const, type: "Interview", organizer: "Axelle Bastin", attendees: ["Axelle Bastin", "Noah Sterling"], locationType: "Company address", place: "avenue Diallo 68 17 / 9 7191 Dilsen-Stokkem Malawi", createdOn: "26/08/2026", createdBy: "Axelle Bastin", updatedOn: "29/08/2026", updatedBy: "Axelle Bastin" },
    { title: "Intro call", date: "14 Aug 2026, 14:30 - 15:00", status: "Completed" as const, type: "Call", organizer: "Noah Sterling", attendees: ["Noah Sterling", "Ava Thompson"], locationType: "Online", place: "https://meet.google.com/wig-gli-demo", provider: "google" as const, createdOn: "12/08/2026", createdBy: "Noah Sterling", updatedOn: "14/08/2026", updatedBy: "Noah Sterling" },
    { title: "Candidate catch-up", date: "05 Aug 2026, 11:00 - 11:30", status: "Canceled" as const, type: "Meeting", organizer: "Axelle Bastin", attendees: ["Axelle Bastin", "Maya Singh"], locationType: "Online", place: "https://zoom.us/j/71574286025", provider: "zoom" as const, createdOn: "03/08/2026", createdBy: "Axelle Bastin", updatedOn: "04/08/2026", updatedBy: "Axelle Bastin" },
  ];

  const personCell = (name: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Avatar name={name} size={32} />
      {name}
    </span>
  );

  const menuItems: PortalMenuItem[] = [
    { label: "Schedule a meeting", icon: CalendarPlus, action: onScheduleInterview },
    { label: "Propose offer", icon: Send },
    { label: "Add note", icon: FileText },
    { label: "Disqualify candidate", icon: CircleX },
    { label: "Send email", icon: Mail },
    { label: "Score candidate", icon: Star },
    { label: "Submit candidate", icon: SendHorizontal },
  ];

  return (
    <DrawerShell open={open} onClose={onClose} title="Progress in job" ariaLabel="Close vacancy progress drawer">
      <div className="vacancy-drawer-body">
        <div className="vacancy-card">
          <div className="vacancy-card-header">
            <h3>{vacancyTitle}</h3>
            <button
              ref={menu.triggerRef}
              className={`vacancy-more-btn ${shouldHighlight ? "highlight-pulse" : ""}`}
              aria-label="Vacancy actions"
              aria-expanded={menu.open}
              onClick={() => { menu.alignMenu(220, "right"); menu.setOpen((v) => !v); }}
              type="button"
            >
              <MoreHorizontal size={16} />
            </button>
            <PortalMenuList
              open={menu.open}
              pos={menu.pos}
              menuRef={menu.menuRef}
              onClose={() => menu.setOpen(false)}
              className="vacancy-actions-menu"
              items={menuItems}
            />
          </div>
          <div className="vacancy-meta">
            <span className="vacancy-pill">Open for internal use</span>
            <span className="vacancy-by">By Axelle Bastin</span>
            <span className="vacancy-dot">•</span>
            <span className="vacancy-due">Due: 17/08/2026</span>
          </div>
        </div>

        <div className="vacancy-tabs" role="tablist">
          {["Application details", "Resume (CV)", "Notes", "AI assessment"].map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={tab === activeTab}
              className={tab === activeTab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="vacancy-section">
          <h4 className="vacancy-section-title">Meeting</h4>
          <div className="jobs-table-wrap" style={{ border: "1px solid #e2e8f0", borderRadius: 10 }}>
            <table className="jobs-table vacancy-meetings-table">
              <thead>
                <tr>{MEETING_COLUMNS.map((c) => <th key={c}><span>{c}</span></th>)}</tr>
              </thead>
              <tbody>
                {meetingRows.map((row) => (
                  <tr key={`m-${row.date}`}>
                    <td style={{ fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>{row.title}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.date}</td>
                    <td><StatusPill status={row.status} /></td>
                    <td>{row.type}</td>
                    <td>{personCell(row.organizer)}</td>
                    <td><AvatarStack names={row.attendees} rowKey="meeting" /></td>
                    <td><LocationTypeCell type={row.locationType} /></td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                        <MeetingPlaceIcon provider={undefined} />
                        {row.place}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.createdOn}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.createdBy}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.updatedOn}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.updatedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="vacancy-section">
          <h4 className="vacancy-section-title">Meeting history</h4>
          <div className="jobs-table-wrap" style={{ border: "1px solid #e2e8f0", borderRadius: 10 }}>
            <table className="jobs-table vacancy-meetings-table">
              <thead>
                <tr>{MEETING_COLUMNS.map((c) => <th key={c}><span>{c}</span></th>)}</tr>
              </thead>
              <tbody>
                {historyRows.map((row, idx) => (
                  <tr key={`h-${idx}`}>
                    <td style={{ fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>{row.title}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.date}</td>
                    <td><StatusPill status={row.status} /></td>
                    <td>{row.type}</td>
                    <td>{personCell(row.organizer)}</td>
                    <td><AvatarStack names={row.attendees} rowKey={`history-${idx}`} /></td>
                    <td><LocationTypeCell type={row.locationType} /></td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                        <MeetingPlaceIcon provider={row.provider} />
                        {row.provider ? <a href={row.place} target="_blank" rel="noreferrer" style={{ color: "#334155", textDecoration: "none" }} title={row.place}>{row.place}</a> : row.place}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.createdOn}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.createdBy}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.updatedOn}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.updatedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="vacancy-status-row">
          <span className="vacancy-status-label">Candidate status</span>
          <span className="vacancy-status-pill">Sourced</span>
        </div>

        <div className="vacancy-sourced-box">Candidate sourced on 03/08/2026 by Axelle Bastin</div>
      </div>
    </DrawerShell>
  );
}
