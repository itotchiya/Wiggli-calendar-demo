"use client";

import { createPortal } from "react-dom";
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Mail, Plus, GripVertical, EyeOff, Search, Bookmark, Columns3, ChevronDown, Send, MessageSquare, Trash2, ClipboardList, FileText, Coins } from "lucide-react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/chrome";
import { useDetailMeetings } from "@/components/crm/detail-meetings";
import { MeetingsTable } from "@/components/crm/meetings-table";
import { EventDrawer, type LinkedContext } from "@/components/event-drawer";
import { VacancyProgressDrawer } from "@/components/crm/vacancy-progress-drawer";
import { getNextQuarterSlot } from "@/lib/datetime-proto";
import { useHighlight } from "@/lib/highlight";
const assessmentsAsset = { src: "/assessments.svg" };
const scorecardAsset = { src: "/scorecard.svg" };

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
  const isSerena = id === "89949590" || id === "serena";
  const name = isSerena ? "serena El Amrani" : `Candidate ${id}`;
  const email = isSerena ? "serena.elamrani@inc.be" : "candidate@example.com";
  const linkedJobTitle = searchParams.get("jobTitle") || "r&d chimistry";
  const initialTab = searchParams.get("tab") === "meetings" ? "Meetings" : "Overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    const desiredTab = activeTab === "Meetings" ? "meetings" : null;
    if (currentTab === desiredTab) return;
    const params = new URLSearchParams(searchParams.toString());
    if (desiredTab) params.set("tab", desiredTab);
    else params.delete("tab");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false } as any);
  }, [activeTab, pathname, router, searchParams]);
  const [addVacancyOpen, setAddVacancyOpen] = useState(false);
  const addVacancyRef = useRef<HTMLDivElement>(null);
  const addVacancyMenuRef = useRef<HTMLDivElement>(null);
  const [addVacancyPos, setAddVacancyPos] = useState<{ top: number; left: number } | null>(null);
  const { has } = useHighlight();
  const shouldHighlight = has("schedule");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleFromProcess, setScheduleFromProcess] = useState(false);
  const [scheduleSlot, setScheduleSlot] = useState({ date: "2026-08-05", hour: 18, minute: 0 });
  const [toast, setToast] = useState("");
  const [vacancyOpen, setVacancyOpen] = useState(false);
  const [meetings, addMeetings] = useDetailMeetings("candidate", id);

  useEffect(() => {
    if (searchParams.get("vacancyDrawer") === "1") {
      setVacancyOpen(true);
      setActiveTab("Processes");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!addVacancyOpen) return;
    const update = () => {
      if (!addVacancyRef.current) return;
      const r = addVacancyRef.current.getBoundingClientRect();
      setAddVacancyPos({ top: r.bottom + 6, left: r.right - 224 });
    };
    update();
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (addVacancyMenuRef.current?.contains(t) || addVacancyRef.current?.contains(t)) return;
      setAddVacancyOpen(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [addVacancyOpen]);

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
      router.replace(`/candidates/${id}${next.size ? `?${next.toString()}` : ""}`);
    }
  };
  const handleCreate = (title: string, occurrences: import("@/components/event-drawer").TimedDate[], meta?: Parameters<typeof addMeetings>[2]) => {
    addMeetings(title, occurrences, meta);
    setScheduleOpen(false);
    setScheduleFromProcess(false);
    setActiveTab("Meetings");
    setToast("Meeting scheduled");
    window.setTimeout(() => setToast(""), 2200);
  };
  const candidateIdSlug = `table-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  const processJobContext: LinkedContext = {
    id: `job-${linkedJobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    kind: "job",
    title: linkedJobTitle,
    contract: "Temporary",
    organizationId: "jacquet-scrl",
    organization: "Jacquet SCRL",
    organizationInitials: "JS",
  };
  const candidateLinkedRecords = [{ type: "Candidate" as const, item: { id: candidateIdSlug, name, email, avatar: "" } }] as any;
  const jobLinkedRecords = [{ type: "Job" as const, item: { id: processJobContext.id, title: processJobContext.title, name: processJobContext.title } }] as any;

  return (
    <>
        <Header kicker={<><span className="kicker-muted">Permanent / </span>{name}</>} />
        <main className="contact-detail-page" style={{ background: "#f8fafc" }}>
          <div className="contact-detail-topbar">
            <button className="contact-back-button" onClick={() => router.back()}>
              <ChevronLeft size={16} /> Back
            </button>
            <div className="contact-detail-nav">
              <button className="contact-nav-arrow" disabled>
                <ChevronLeft size={16} />
              </button>
              <button className="contact-nav-arrow">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="contact-detail-main-card">
            <div className="contact-detail-header">
              <div className="contact-detail-identity">
                <span className="contact-detail-avatar" style={{ background: "#d94f2b" }}>
                  SE
                </span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#1e293b" }}>{name}</span>
                    <span style={{ color: "#64748b", fontSize: 14 }}>ⓘ</span>
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
                <button onClick={handleSchedule} className={shouldHighlight ? "highlight-pulse" : ""} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, color: "#334155", fontWeight: 500, fontSize: 14, boxShadow: "0 1px 2px rgba(15,23,42,.04)", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <CalendarPlus size={18} /> Schedule a meeting
                </button>
                <div ref={addVacancyRef} style={{ display: "inline-flex", border: "1px solid #0f766e", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <button style={{ padding: "8px 14px", border: 0, background: "#fff", color: "#0f766e", fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center" }}>Add to a job</button>
                  <button onClick={() => setAddVacancyOpen((v) => !v)} aria-expanded={addVacancyOpen} style={{ padding: "8px 10px", border: 0, borderLeft: "1px solid #0f766e", background: "#fff", color: "#0f766e", display: "grid", placeItems: "center", cursor: "pointer" }}>
                    <ChevronDown size={14} style={{ transform: addVacancyOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                  </button>
                </div>
                {addVacancyOpen && addVacancyPos && typeof document !== "undefined" && createPortal(
                  <div ref={addVacancyMenuRef} className="contact-more-menu" role="menu" style={{ top: addVacancyPos.top, left: addVacancyPos.left }}>
                    <button role="menuitem" onClick={() => setAddVacancyOpen(false)}><Send size={16} /> Send vacancy</button>
                    <button role="menuitem" onClick={() => setAddVacancyOpen(false)}><Mail size={16} /> Send email</button>
                    <button role="menuitem" onClick={() => setAddVacancyOpen(false)}><ClipboardList size={16} /> Add task</button>
                    <button role="menuitem" onClick={() => setAddVacancyOpen(false)}><MessageSquare size={16} /> Add note</button>
                    <button role="menuitem" onClick={() => setAddVacancyOpen(false)}><Send size={16} /> Submit candidate</button>
                    <button role="menuitem" onClick={() => setAddVacancyOpen(false)}><EyeOff size={16} /> Hide permanently</button>
                    <button role="menuitem" className="danger" onClick={() => setAddVacancyOpen(false)}><Trash2 size={16} /> Delete</button>
                  </div>, document.body
                )}
              </div>
            </div>

            <div className="contact-detail-tabs" role="tablist">
              {tabs.map((t) => {
                const clickable = t === "Overview" || t === "Processes" || t === "Meetings";
                return (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={t === activeTab}
                    className={t === activeTab ? "active" : ""}
                    onClick={() => { if (clickable) setActiveTab(t); }}
                    style={{ cursor: clickable ? "pointer" : "default" }}
                    aria-disabled={!clickable}
                  >
                    {t}{t === "Meetings" && <span className="detail-tab-new-badge">NEW</span>}
                  </button>
                );
              })}
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 13 }}><span style={{ display: "grid", placeItems: "center", width: 16, height: 16, border: "1px solid #e2e8f0", borderRadius: 4 }}>⊞</span> Layout</span>
            </div>
          </div>

          {activeTab === "Meetings" ? (
            <MeetingsTable filterEntity="candidate" filterId={id} filterName={name} extraMeetings={meetings} onScheduleMeeting={handleSchedule} />
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
                    <button onClick={() => setVacancyOpen(true)} style={{ background: "transparent", border: 0, color: "#0f766e", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>Full view</button>
                  </div>
                </section>

                <div style={{ fontSize: 14, fontWeight: 500, color: "#334155", marginTop: 4 }}>All vacancies</div>
                <section className="contact-detail-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "#fff", flex: "0 0 220px" }}>
                      <Search size={14} style={{ color: "#94a3b8" }} />
                      <input placeholder="Search" style={{ border: 0, outline: 0, fontSize: 13, width: "100%" }} />
                    </label>
                    <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f1f5f9", color: "#475569", fontSize: 13, cursor: "pointer" }}>
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
                    <img src={assessmentsAsset.src} alt="" width={132} height={132} />
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
                      <img src={scorecardAsset.src} alt="" width={132} height={132} />
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
        <EventDrawer open={scheduleOpen} onClose={() => { setScheduleOpen(false); setScheduleFromProcess(false); }} slot={scheduleSlot} onCreate={handleCreate} initialLinkedRecords={scheduleFromProcess ? jobLinkedRecords : candidateLinkedRecords} fixedEventType="Meeting" />
        <div className={`toast ${toast ? "shown" : ""}`}>{toast}</div>
      </>
  );
}
