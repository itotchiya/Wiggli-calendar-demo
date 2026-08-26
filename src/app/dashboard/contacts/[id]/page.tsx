"use client";

import { createPortal } from "react-dom";
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Mail, MoreHorizontal, Pencil, Plus, Sparkles, Briefcase, Coins, Target, Building2, FileText, Grip, MessageSquare, Send, Trash2, FileText as FileDoc } from "lucide-react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/chrome";
import { useDetailMeetings } from "@/components/crm/detail-meetings";
import { MeetingsTable } from "@/components/crm/meetings-table";
import { EventDrawer } from "@/components/event-drawer";
import { getNextQuarterSlot } from "@/lib/datetime-proto";
import { useHighlight } from "@/lib/highlight";
import { findContact } from "../data";

const tabs = ["Overview", "Details", "Organizations", "Opportunities", "Jobs", "Meetings", "Notes", "Files", "Tasks", "Submitted candidates", "Activity"];

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contact = findContact(params.id);
  const { has } = useHighlight();
  const shouldHighlight = has("schedule");
  const searchParams = useSearchParams();
  const pathname = usePathname();
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
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (shouldHighlight) setMoreOpen(true);
  }, [shouldHighlight]);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [morePos, setMorePos] = useState<{ top: number; left: number } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSlot, setScheduleSlot] = useState({ date: "2026-08-05", hour: 18, minute: 0 });
  const [toast, setToast] = useState("");
  const [meetings, addMeetings] = useDetailMeetings("contact", String(params.id));

  useEffect(() => {
    if (!moreOpen) return;
    const updatePos = () => {
      if (!moreBtnRef.current) return;
      const rect = moreBtnRef.current.getBoundingClientRect();
      setMorePos({ top: rect.bottom + 6, left: rect.right - 224 });
    };
    updatePos();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (moreMenuRef.current?.contains(t) || moreBtnRef.current?.contains(t)) return;
      setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [moreOpen]);

  const handleSchedule = () => {
    setMoreOpen(false);
    setScheduleSlot(getNextQuarterSlot());
    setScheduleOpen(true);
  };
  const handleCreate = (title: string, occurrences: import("@/components/event-drawer").TimedDate[], meta?: Parameters<typeof addMeetings>[2]) => {
    addMeetings(title, occurrences, meta);
    setScheduleOpen(false);
    setActiveTab("Meetings");
    setToast(`Meeting with ${contact.name} scheduled`);
    window.setTimeout(() => setToast(""), 2200);
  };
  return (
    <>
        <Header kicker={<><span className="kicker-muted">Contacts / </span>{contact.name}</>} />
        <main className="contact-detail-page">
          <div className="contact-detail-topbar">
            <button className="contact-back-button" onClick={() => router.back()}>
              <ChevronLeft size={16} /> Back
            </button>
            <div className="contact-detail-nav">
              <button className="contact-nav-arrow" disabled aria-label="Previous">
                <ChevronLeft size={16} />
              </button>
              <button className="contact-nav-arrow" aria-label="Next">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="contact-detail-main-card">
            <div className="contact-detail-header">
              <div className="contact-detail-identity">
                <span className="contact-detail-avatar" style={{ background: contact.avatarColor }}>
                  {contact.avatar}
                </span>
                <div className="contact-detail-name">
                  <span>
                    {contact.name} <span className="contact-detail-status"><span>{contact.status}</span> <ChevronDown size={12} /></span>
                  </span>
                </div>
                <div className="contact-detail-info">
                  <span className="contact-detail-info-label">Contact information</span>
                  <span className="contact-detail-email">
                    <Mail size={14} /> {contact.email}
                  </span>
                </div>
              </div>
              <div className="contact-detail-actions">
                <button ref={moreBtnRef} className={`contact-detail-more ${shouldHighlight ? "highlight-pulse" : ""}`} aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
                  More <ChevronDown size={14} style={{ transform: moreOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                </button>
                {moreOpen && morePos && typeof document !== "undefined" && createPortal(
                  <div ref={moreMenuRef} className="contact-more-menu" role="menu" style={{ top: morePos.top, left: morePos.left }}>
                    <button role="menuitem" onClick={() => setMoreOpen(false)}><FileDoc size={18} /> Link organization</button>
                    <button role="menuitem" className={shouldHighlight ? "highlight-menu-item" : ""} onClick={handleSchedule}><CalendarPlus size={18} /> Schedule a meeting</button>
                    <button role="menuitem" onClick={() => setMoreOpen(false)}><MessageSquare size={18} /> Add note</button>
                    <button role="menuitem" onClick={() => setMoreOpen(false)}><Send size={18} style={{ transform: "rotate(-20deg)" }} /> Submit candidate</button>
                    <button role="menuitem" className="danger" onClick={() => setMoreOpen(false)}><Trash2 size={18} /> Delete contact</button>
                  </div>, document.body
                )}
                <button className="contact-detail-add"><Plus size={14} /> Add Job</button>
              </div>
            </div>

            <div className="contact-detail-tabs" role="tablist">
              {tabs.map((tab) => {
                const clickable = tab === "Overview" || tab === "Meetings";
                return <button key={tab} role="tab" aria-selected={tab === activeTab} className={tab === activeTab ? "active" : ""} onClick={() => { if (clickable) setActiveTab(tab); }} style={!clickable ? { opacity: 0.55, cursor: "default" } : undefined} aria-disabled={!clickable}>{tab}{tab === "Meetings" && <span className="detail-tab-new-badge">NEW</span>}</button>;
              })}
            </div>
          </div>

          {activeTab === "Meetings" ? <MeetingsTable filterEntity="contact" filterId={String(params.id)} filterName={contact.name} extraMeetings={meetings} onScheduleMeeting={handleSchedule} /> : <div className="contact-detail-grid">
            <section className="contact-detail-card"><header><span className="contact-card-title"><Grip size={14} className="contact-card-grip" /> Organizations <i>1</i></span><div className="contact-card-header-actions"><button aria-label="Add"><Plus size={14} /></button><button aria-label="Collapse"><ChevronDown size={14} style={{ transform: "rotate(180deg)" }} /></button></div></header><div className="contact-card-body"><div className="contact-card-org"><span className="contact-card-org-pill" style={{ background: "#c53678" }}>T</span><div><div className="contact-card-org-title">testing-organization-v7 <span className="contact-card-org-meta"><Building2 size={12} /> Subsidiary · <Building2 size={12} /> Government / Non-profit</span></div><div className="contact-card-org-sub">delegue</div></div><span className="contact-card-org-actions"><button aria-label="Edit"><Pencil size={14} /></button><button aria-label="AI"><Sparkles size={14} className="contact-card-spark" /></button></span></div></div><footer><button>View all</button></footer></section>
            <section className="contact-detail-card"><header><span className="contact-card-title"><Grip size={14} className="contact-card-grip" /> Opportunities <i>1</i></span><div className="contact-card-header-actions"><button aria-label="Add"><Plus size={14} /></button><button aria-label="Collapse"><ChevronDown size={14} style={{ transform: "rotate(180deg)" }} /></button></div></header><div className="contact-card-body"><div className="contact-card-opp"><span className="contact-card-opp-icon"><Target size={16} /></span><div><div className="contact-card-opp-title">Scelerisque senectus sodales vivamus ligula</div><div className="contact-card-opp-sub"><Coins size={12} /> 8 640 $</div></div></div></div><footer><button>View all</button></footer></section>
            <section className="contact-detail-card"><header><span className="contact-card-title"><Grip size={14} className="contact-card-grip" /> Jobs <i>1</i></span><div className="contact-card-header-actions"><button aria-label="Add"><Plus size={14} /></button><button aria-label="Collapse"><ChevronDown size={14} style={{ transform: "rotate(180deg)" }} /></button></div></header><div className="contact-card-body"><div className="contact-card-job"><span className="contact-card-job-icon"><Briefcase size={16} /></span><div><div className="contact-card-job-title">testing crm job</div><div className="contact-card-job-sub">Temporary · <Coins size={12} /> 3 094 $</div></div><span className="contact-card-job-status">Opened</span></div></div><footer><button>View all</button></footer></section>
            <section className="contact-detail-card"><header><span className="contact-card-title"><Grip size={14} className="contact-card-grip" /> Notes <i>0</i></span><div className="contact-card-header-actions"><button aria-label="Add"><Plus size={14} /></button><button aria-label="Collapse"><ChevronDown size={14} style={{ transform: "rotate(180deg)" }} /></button></div></header><div className="contact-card-body contact-card-body--empty"><img src="https://front.develop.hme.ovh/static/media/empty-state-note.46815edd.svg" alt="No notes" width={96} height={96} style={{ objectFit: "contain" }} /><strong>No notes yet</strong><span>Notes left on this record will appear here.</span></div><footer><button>View all</button></footer></section>
          </div>}
        </main>
        <EventDrawer open={scheduleOpen} onClose={() => setScheduleOpen(false)} slot={scheduleSlot} onCreate={handleCreate} initialLinkedRecords={[{ type: "Contact" as const, item: { id: String(contact.id), name: contact.name, email: contact.email, avatar: contact.avatar } }]} fixedEventType="Meeting" />
        <div className={`toast ${toast ? "shown" : ""}`}>{toast}</div>
      </>
  );
}
