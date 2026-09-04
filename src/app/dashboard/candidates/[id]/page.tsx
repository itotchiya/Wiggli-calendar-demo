"use client";

import { AlertTriangle, CalendarPlus, Mail, Plus, GripVertical, EyeOff, Search, ChevronDown, Send, MessageSquare, Trash2, ClipboardList, Coins } from "lucide-react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/chrome";
import { MeetingsTable } from "@/components/meetings-table";
import { EventDrawer, type LinkedContext } from "@/components/event-drawer";
import { VacancyProgressDrawer } from "@/components/vacancy-progress-drawer";
import { usePortalMenu, PortalMenuList } from "@/components/ui/portal-menu";
import { DetailTabs } from "@/components/ui/detail-tabs";
import { DetailTopbar } from "@/components/ui/detail-topbar";
import { getNextQuarterSlot } from "@/lib/datetime-proto";
import { showToast } from "@/components/toaster";
import type { EventDto } from "@/types/event";
import { findCandidate } from "../../jobs/data";

const tabs = ["Overview", "Profile", "Scorecards", "Processes", "Meetings", "Interactions", "Notes", "Files", "Conversations", "AI assessments", "Placements", "Submissions"];

function CandidateOverviewCard({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`candidate-overview-card ${className}`}>
      <header><span><GripVertical size={15} />{title}</span><EyeOff size={16} /></header>
      {children}
      <footer><button type="button">View More</button></footer>
    </section>
  );
}

export default function SingleCandidatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const id = params.id as string;
  const record = findCandidate(id);
  const name = `${record.firstName} ${record.lastName}`.trim();
  const email = record.email !== "—" ? record.email : "candidate@example.com";
  const linkedJobTitle = searchParams.get("jobTitle") || "r&d chimistry";
  const initialTab = searchParams.get("tab") === "meetings" ? "Meetings" : "Overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    const desiredTab = activeTab === "Meetings" ? "meetings" : null;
    if (currentTab === desiredTab) return;
    const next = new URLSearchParams(searchParams.toString());
    if (desiredTab) next.set("tab", desiredTab);
    else next.delete("tab");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [activeTab, pathname, router, searchParams]);
  const menu = usePortalMenu();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleFromProcess, setScheduleFromProcess] = useState(false);
  const [scheduleSlot, setScheduleSlot] = useState(getNextQuarterSlot());
  const [vacancyOpen, setVacancyOpen] = useState(false);
  const [dbMeetings, setDbMeetings] = useState<Record<string, unknown>[]>([]);

  const loadMeetings = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) return;
      const data = await res.json();
      const events: EventDto[] = Array.isArray(data) ? data : data.events ?? [];
      const linked = events.filter((e) =>
        (e.previewData?.linkedTo ?? []).some((l) => l.type === "Candidate" && l.label === name) ||
        e.attendees.some((a) => (a.name ?? "") === name || a.email === email)
      );
      setDbMeetings(linked.map((e) => {
        const start = new Date(e.start);
        const end = new Date(e.end);
        return {
          title: e.summary,
          date: `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, ${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")} - ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
          eventType: e.eventType ?? "Meeting",
          linkedCandidate: { id, name, avatar: "" },
          attendees: e.attendees.map((a) => ({ name: a.name ?? a.email })),
          locationType: e.hangoutLink ? "Online" : "Company address",
          aiNotetaker: e.previewData?.aiNotetaker === true,
          meetingPlace: e.hangoutLink ?? e.location ?? "",
          meetingLink: e.hangoutLink ?? "",
          provider: e.hangoutLink ? "google" : "company",
        };
      }));
    } catch {
      /* seeded-only */
    }
  }, [name, email, id]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    if (searchParams.get("vacancyDrawer") === "1") {
      setVacancyOpen(true);
      setActiveTab("Processes");
    }
  }, [searchParams]);

  const handleSchedule = () => {
    setScheduleFromProcess(false);
    setScheduleSlot(getNextQuarterSlot());
    setScheduleOpen(true);
  };
  const handleVacancySchedule = () => {
    setVacancyOpen(false);
    setScheduleFromProcess(true);
    setScheduleSlot(getNextQuarterSlot());
    setScheduleOpen(true);
  };
  const handleVacancyClose = () => {
    setVacancyOpen(false);
    if (searchParams.get("vacancyDrawer") === "1") {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("vacancyDrawer");
      router.replace(`/dashboard/candidates/${id}${next.size ? `?${next.toString()}` : ""}`);
    }
  };
  const handleCreate = () => {
    setScheduleOpen(false);
    setScheduleFromProcess(false);
    setActiveTab("Meetings");
    showToast("Meeting scheduled — synced to calendar");
    void loadMeetings();
    window.setTimeout(() => void loadMeetings(), 1800);
  };
  const processJobContext: LinkedContext = {
    id: `job-${linkedJobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    kind: "job",
    title: linkedJobTitle,
    contract: "Temporary",
    organizationId: "jacquet-scrl",
    organization: "Jacquet SCRL",
    organizationInitials: "JS",
  };
  const candidateLinkedRecords = [{ type: "Candidate" as const, item: { id, name, email, avatar: "" } }];
  const jobLinkedRecords = [{ type: "Job" as const, item: { id: processJobContext.id, title: processJobContext.title, name: processJobContext.title } }];

  return (
    <>
      <Header kicker={<><span className="kicker-muted">Permanent / </span>{name}</>} />
      <main className="contact-detail-page" style={{ background: "#f8fafc" }}>
        <DetailTopbar onBack={() => router.back()} nextDisabled={false} />

        <div className="contact-detail-main-card">
          <div className="contact-detail-header">
            <div className="contact-detail-identity">
              <span className="contact-detail-avatar" style={{ background: "#d94f2b" }}>
                {name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "#1e293b" }}>{name}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "#e0f2fe", color: "#0284c7", fontSize: 12, fontWeight: 600 }}>
                    ◇ Permanent <ChevronDown size={12} />
                  </span>
                </div>
              </div>
              <div className="contact-detail-info">
                <span className="contact-detail-info-label">Contact information</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="contact-detail-email">
                    <Mail size={14} /> {email}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#f1f5f9", borderRadius: 8, color: "#94a3b8", fontSize: 13, opacity: 0.7, cursor: "not-allowed", border: "1px solid #e2e8f0" }}>
                    Reveal Phone <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#e2e8f0", color: "#64748b", padding: "2px 6px", borderRadius: 999, fontSize: 11 }}><Coins size={12} /> 2</span>
                  </span>
                  <span title="LinkedIn" style={{ width: 32, height: 32, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, display: "grid", placeItems: "center", color: "#0a66c2", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>in</span>
                </div>
              </div>
            </div>
            <div className="contact-detail-actions">
              <button ref={menu.triggerRef} className="contact-detail-more" aria-expanded={menu.open} onClick={() => { menu.alignMenu(224, "right"); menu.setOpen((v) => !v); }} type="button">
                More <ChevronDown size={14} style={{ transform: menu.open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </button>
              <PortalMenuList
                open={menu.open}
                pos={menu.pos}
                menuRef={menu.menuRef}
                onClose={() => menu.setOpen(false)}
                items={[
                  { label: "Schedule a meeting", icon: CalendarPlus, action: handleSchedule },
                  { label: "Send vacancy", icon: Send },
                  { label: "Send email", icon: Mail },
                  { label: "Add task", icon: ClipboardList },
                  { label: "Add note", icon: MessageSquare },
                  { label: "Submit candidate", icon: Send },
                  { label: "Hide permanently", icon: EyeOff },
                  { label: "Delete", icon: Trash2, danger: true },
                ]}
              />
              <button className="contact-detail-add" type="button"><Plus size={14} /> Add to a job</button>
            </div>
          </div>

          <DetailTabs
            tabs={tabs.map((t) => ({ label: t, isNew: t === "Meetings" }))}
            active={activeTab}
            onChange={setActiveTab}
            variant="contact"
            clickable={(t) => t === "Overview" || t === "Processes" || t === "Meetings"}
            trailing={<span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 13 }}><span style={{ display: "grid", placeItems: "center", width: 16, height: 16, border: "1px solid #e2e8f0", borderRadius: 4 }}>⊞</span> Layout</span>}
          />
        </div>

        {activeTab === "Meetings" ? (
          <MeetingsTable filterEntity="candidate" filterId={id} filterName={name} extraMeetings={dbMeetings} onScheduleMeeting={handleSchedule} />
        ) : activeTab === "Processes" ? (
          <div className="contact-detail-grid" style={{ gridTemplateColumns: "1.6fr 0.7fr" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#334155" }}>Active Processes</div>
              <section className="contact-detail-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ChevronDown size={14} style={{ color: "#475569" }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>r&d chimistry</span>
                    </div>
                    <div style={{ marginTop: 8, paddingLeft: 22, display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 12, flexWrap: "wrap" }}>
                      <span>By Axelle Bastin</span><span>•</span><span>Open For Internal Use</span><span>•</span><span>Due: 17/08/2026</span>
                    </div>
                  </div>
                  <button onClick={() => setVacancyOpen(true)} style={{ background: "transparent", border: 0, color: "#0f766e", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }} type="button">Full view</button>
                </div>
              </section>

              <div style={{ fontSize: 14, fontWeight: 500, color: "#334155", marginTop: 4 }}>All vacancies</div>
              <section className="contact-detail-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", flex: "0 0 220px" }}>
                    <Search size={14} style={{ color: "#94a3b8" }} />
                    <input placeholder="Search" style={{ border: 0, outline: 0, fontSize: 13, width: "100%" }} />
                  </label>
                  <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f1f5f9", color: "#475569", fontSize: 13, cursor: "pointer" }} type="button">
                    Sort by <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><ChevronDown size={12} /><ChevronDown size={12} style={{ marginLeft: -6, opacity: 0.6 }} /></span>
                  </button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569", fontSize: 12 }}>
                        <th style={{ padding: "10px 16px", fontWeight: 600, whiteSpace: "nowrap" }}>Date<br />created</th>
                        <th style={{ padding: "10px 16px", fontWeight: 600 }}>Job</th>
                        <th style={{ padding: "10px 16px", fontWeight: 600 }}>Last stage</th>
                        <th style={{ padding: "10px 16px", fontWeight: 600, whiteSpace: "nowrap" }}>Date reached</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 16px", color: "#334155", whiteSpace: "nowrap" }}>03/08/2026</td>
                        <td style={{ padding: "12px 16px", color: "#1e293b", fontWeight: 500 }}>r&d chimistry</td>
                        <td style={{ padding: "12px 16px" }}><span style={{ padding: "4px 10px", borderRadius: 999, background: "#f0fdfa", color: "#0f766e", fontSize: 12, border: "1px solid #ccfbf1" }}>Applications</span></td>
                        <td style={{ padding: "12px 16px", color: "#334155" }}>08/08/2026</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #f1f5f9", fontSize: 13, color: "#64748b" }}>
                  <span>Showing <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 8px", background: "#fff", marginLeft: 6 }}>8 <ChevronDown size={12} /></span> <span style={{ marginLeft: 8 }}>of 1 results found</span></span>
                </div>
              </section>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <section className="contact-detail-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Vacancies processed in</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.4 }}>Number of vacancies in which the candidate is/was being processed</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#059669" }}>1</div>
                    <div style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>Active</div>
                  </div>
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#dc2626" }}>0</div>
                    <div style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>Closed</div>
                  </div>
                </div>
              </section>

              <section className="contact-detail-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Vacancies progress</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.4 }}>Stats of each time a stage was reached by candidate in all current and previous vacancies</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                  {[
                    { label: "Application", value: 0 },
                    { label: "Sourced", value: 1 },
                    { label: "Phone screen", value: 0 },
                    { label: "Interview", value: 0 },
                    { label: "Offer", value: 0 },
                    { label: "Hired", value: 0 },
                  ].map((s) => (
                    <div key={s.label} style={{ background: "#f0fdfa", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#0f766e" }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: "#115e59" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="candidate-overview-grid">
            <div className="candidate-overview-column">
              <CandidateOverviewCard title="AI assessments" className="candidate-overview-card--assessment">
                <div className="candidate-overview-empty">
                  <strong>No AI assessments yet</strong>
                  <p>Start by creating an AI assessment<br />for this candidate.</p>
                </div>
              </CandidateOverviewCard>
              <CandidateOverviewCard title="Functions" className="candidate-overview-card--compact">
                <div className="candidate-overview-no-results"><AlertTriangle size={29} /><span>No results to show</span></div>
              </CandidateOverviewCard>
              <CandidateOverviewCard title="Skills" className="candidate-overview-card--compact">
                <div className="candidate-overview-no-results"><AlertTriangle size={29} /><span>No results to show</span></div>
              </CandidateOverviewCard>
            </div>
            <div className="candidate-overview-column">
              <CandidateOverviewCard title="Scorecards" className="candidate-overview-card--scorecard">
                <div className="candidate-scorecard-well">
                  <div className="candidate-overview-empty">
                    <strong>No scorecard recorded yet.</strong>
                    <p>Begin the scorecard process to document candidate skills and performance.</p>
                  </div>
                </div>
              </CandidateOverviewCard>
              <CandidateOverviewCard title="Preferences" className="candidate-overview-card--preferences">
                <div className="candidate-preferences-body">Extra benefits</div>
              </CandidateOverviewCard>
            </div>
          </div>
        )}
      </main>
      <VacancyProgressDrawer open={vacancyOpen} onClose={handleVacancyClose} onScheduleInterview={handleVacancySchedule} />
      <EventDrawer
        open={scheduleOpen}
        onClose={() => { setScheduleOpen(false); setScheduleFromProcess(false); }}
        slot={scheduleSlot}
        onCreate={handleCreate}
        initialLinkedRecords={(scheduleFromProcess ? [...jobLinkedRecords, ...candidateLinkedRecords] : candidateLinkedRecords) as never}
        fixedEventType="Meeting"
      />
    </>
  );
}
