"use client";

import { createPortal } from "react-dom";
import {
  CalendarPlus,
  CircleX,
  FileText,
  Mail,
  MoreHorizontal,
  Send,
  SendHorizontal,
  Star,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHighlight } from "@/lib/highlight";
import { StatusPill, LocationTypeCell, MeetingPlaceIcon } from "./meetings-table";

type VacancyProgressDrawerProps = {
  open: boolean;
  onClose: () => void;
  vacancyTitle?: string;
  onScheduleInterview?: () => void;
};

export function VacancyProgressDrawer({
  open,
  onClose,
  vacancyTitle = "r&d chimistry",
  onScheduleInterview,
}: VacancyProgressDrawerProps) {
  const { has } = useHighlight();
  const shouldHighlight = has("schedule");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Application details");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [hoverAttendee, setHoverAttendee] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);

  const meetingRows = [
    { title: "Interview with Axelle Bastin", date: "29 Aug 2026, 09:00 - 10:00", status: "Scheduled" as const, type: "Interview", organizer: "Axelle Bastin", attendees: ["Axelle Bastin", "Noah Sterling"], locationType: "Company address", place: "avenue Diallo 68 17 / 9 7191 Dilsen-Stokkem Malawi", createdOn: "26/08/2026", createdBy: "Axelle Bastin", updatedOn: "27/08/2026", updatedBy: "Axelle Bastin" },
  ];
  const historyRows = [
    { title: "Interview — round 1", date: "29 Aug 2026, 09:00 - 10:00", status: "Completed" as const, type: "Interview", organizer: "Axelle Bastin", attendees: ["Axelle Bastin", "Noah Sterling"], locationType: "Company address", place: "avenue Diallo 68 17 / 9 7191 Dilsen-Stokkem Malawi", createdOn: "26/08/2026", createdBy: "Axelle Bastin", updatedOn: "29/08/2026", updatedBy: "Axelle Bastin" },
    { title: "Intro call", date: "14 Aug 2026, 14:30 - 15:00", status: "Completed" as const, type: "Call", organizer: "Noah Sterling", attendees: ["Noah Sterling", "Ava Thompson"], locationType: "Online", place: "https://meet.google.com/wig-gli-demo", provider: "google" as const, createdOn: "12/08/2026", createdBy: "Noah Sterling", updatedOn: "14/08/2026", updatedBy: "Noah Sterling" },
    { title: "Candidate catch-up", date: "05 Aug 2026, 11:00 - 11:30", status: "Canceled" as const, type: "Meeting", organizer: "Axelle Bastin", attendees: ["Axelle Bastin", "Maya Singh"], locationType: "Online", place: "https://zoom.us/j/71574286025", provider: "zoom" as const, createdOn: "03/08/2026", createdBy: "Axelle Bastin", updatedOn: "04/08/2026", updatedBy: "Axelle Bastin" },
  ];

  const avatarColor = (name: string) => ["#667eea", "#0f766e", "#c06c84", "#4f7c8d", "#8b6fc0", "#d97757"][name.charCodeAt(0) % 6];
  const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const personCell = (name: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 32, height: 32, borderRadius: "50%", background: avatarColor(name), color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 500, flex: "none", border: "1px solid #e2e8f0", overflow: "hidden" }}>{initials(name)}</span>
      {name}
    </span>
  );
  const attendeeStack = (names: string[], rowKey: string) => (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {names.slice(0, 5).map((name, idx) => (
        <span
          key={name + idx}
          onMouseEnter={(e) => { setHoverRect(e.currentTarget.getBoundingClientRect()); setHoverAttendee(rowKey + name); }}
          onMouseLeave={() => { setHoverRect(null); setHoverAttendee(null); }}
          style={{ marginLeft: idx === 0 ? 0 : -8, position: "relative", cursor: "pointer" }}
        >
          <span style={{ width: 32, height: 32, borderRadius: "50%", background: avatarColor(name), color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 500, flex: "none", border: "1px solid #e2e8f0", overflow: "hidden" }}>{initials(name)}</span>
          {hoverAttendee === rowKey + name && hoverRect && typeof document !== "undefined" && createPortal(
            <span style={{ position: "fixed", left: hoverRect.left + hoverRect.width / 2, top: hoverRect.top - 36, transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 12, whiteSpace: "nowrap", zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,.2)", pointerEvents: "none" }}>
              {name}
            </span>, document.body)}
        </span>
      ))}
      {names.length > 5 && <span style={{ marginLeft: 4, fontSize: 12, color: "#64748b" }}>+{names.length - 5}</span>}
    </span>
  );

  useEffect(() => {
    if (open && shouldHighlight) setMenuOpen(true);
  }, [open, shouldHighlight]);

  useEffect(() => {
    if (!menuOpen) return;
    const update = () => {
      if (!buttonRef.current) return;
      const r = buttonRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.right - 220 });
    };
    update();
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!open) setMenuOpen(false);
  }, [open]);

  const menuItems = [
    { label: "Schedule a meeting", icon: CalendarPlus, action: onScheduleInterview },
    { label: "Propose offer", icon: Send },
    { label: "Add note", icon: FileText },
    { label: "Disqualify candidate", icon: CircleX },
    { label: "Send email", icon: Mail },
    { label: "Score candidate", icon: Star },
    { label: "Submit candidate", icon: SendHorizontal },
  ];

  return (
    <>
      <button
        className={`drawer-scrim ${open ? "visible" : ""}`}
        onClick={onClose}
        aria-label="Close vacancy progress drawer"
        style={{ zIndex: 65 } as React.CSSProperties}
      />
      <aside
        className={`event-drawer ${open ? "open" : ""}`}
        aria-hidden={!open}
        style={{ zIndex: 66 } as React.CSSProperties}
      >
        <div className="drawer-heading">
          <h2>Progress in job</h2>
          <button onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="vacancy-drawer-body">
          <div className="vacancy-card">
            <div className="vacancy-card-header">
              <h3>{vacancyTitle}</h3>
              <button
                ref={buttonRef}
                className={`vacancy-more-btn ${shouldHighlight ? "highlight-pulse" : ""}`}
                aria-label="Vacancy actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen &&
                pos &&
                typeof document !== "undefined" &&
                createPortal(
                  <div ref={menuRef} className="vacancy-actions-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const isSchedule = item.label === "Schedule a meeting";
                      return (
                        <button
                          key={item.label}
                          role="menuitem"
                          type="button"
                          className={isSchedule && shouldHighlight ? "highlight-menu-item" : ""}
                          onClick={() => {
                            setMenuOpen(false);
                            item.action?.();
                          }}
                        >
                          <Icon size={15} /> {item.label}
                        </button>
                      );
                    })}
                  </div>,
                  document.body
                )}
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
                  <tr>
                    <th><span>Title</span></th>
                    <th><span>Meeting date & time</span></th>
                    <th><span>Status</span></th>
                    <th><span>Meeting type</span></th>
                    <th><span>Organizer</span></th>
                    <th><span>Attendees</span></th>
                    <th><span>Location type</span></th>
                    <th><span>Meeting place</span></th>
                    <th><span>Created on</span></th>
                    <th><span>Created by</span></th>
                    <th><span>Updated on</span></th>
                    <th><span>Updated by</span></th>
                  </tr>
                </thead>
                <tbody>
                  {meetingRows.map((row) => (
                    <tr key={`m-${row.date}`}>
                      <td style={{ fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>{row.title}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{row.date}</td>
                      <td><StatusPill status={row.status} /></td>
                      <td>{row.type}</td>
                      <td>{personCell(row.organizer)}</td>
                      <td>{attendeeStack(row.attendees, "meeting")}</td>
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
                  <tr>
                    <th><span>Title</span></th>
                    <th><span>Meeting date & time</span></th>
                    <th><span>Status</span></th>
                    <th><span>Meeting type</span></th>
                    <th><span>Organizer</span></th>
                    <th><span>Attendees</span></th>
                    <th><span>Location type</span></th>
                    <th><span>Meeting place</span></th>
                    <th><span>Created on</span></th>
                    <th><span>Created by</span></th>
                    <th><span>Updated on</span></th>
                    <th><span>Updated by</span></th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row, idx) => (
                    <tr key={`h-${idx}`}>
                      <td style={{ fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>{row.title}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{row.date}</td>
                      <td><StatusPill status={row.status} /></td>
                      <td>{row.type}</td>
                      <td>{personCell(row.organizer)}</td>
                      <td>{attendeeStack(row.attendees, `history-${idx}`)}</td>
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
      </aside>
    </>
  );
}
