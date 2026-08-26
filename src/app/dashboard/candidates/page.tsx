"use client";

import { createPortal } from "react-dom";
import {
  Bookmark,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Expand,
  Eye,
  EyeOff,
  LayoutGrid,
  ListFilter,
  Mail,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Send,
  Table2,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/chrome";
import { EventDrawer } from "@/components/event-drawer";
import { getNextQuarterSlot } from "@/lib/datetime-proto";
import { useHighlight } from "@/lib/highlight";

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  workType: string;
  email: string;
  phone: string;
  hasLinkedJob: boolean;
  jobTitle?: string;
};

type CandidateRowData = Candidate & {
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

const candidates: CandidateRowData[] = [
  { id: "89949590", firstName: "serena", lastName: "El Amrani", workType: "Permanent", jobTitle: "—", email: "serena.elamrani@inc.be", phone: "—", externalProfile: "—", employmentType: "permanent", residence: "—", extraBenefits: "—", category: "—", subCategory: "—", functions: "—", seniority: "—", skills: "—", languages: "—", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: false },
  { id: "89949589", firstName: "robert", lastName: "D", workType: "Permanent", jobTitle: "Compliance Assistant", email: "robert.d@inc.com", phone: "NL +31614253377", externalProfile: "—", employmentType: "permanent", residence: "—", extraBenefits: "—", category: "Compliance & Regulatory", subCategory: "Compliance Management", functions: "Export/Import Compliance", seniority: "junior", skills: "—", languages: "—", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949588", firstName: "salma", lastName: "addan", workType: "Permanent", jobTitle: "—", email: "salma.addan@gmail.com", phone: "NL +31614253378", externalProfile: "—", employmentType: "permanent", residence: "—", extraBenefits: "—", category: "—", subCategory: "—", functions: "—", seniority: "—", skills: "—", languages: "—", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: false },
  { id: "89949587", firstName: "farah", lastName: "faraj", workType: "Hybrid", jobTitle: "—", email: "fara.faraj@gmail.com", phone: "NL +31614253377", externalProfile: "—", employmentType: "permanent", residence: "—", extraBenefits: "—", category: "—", subCategory: "—", functions: "—", seniority: "—", skills: "—", languages: "—", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: false },
  { id: "89949582", firstName: "Amine", lastName: "Ouaziz", workType: "Freelance", jobTitle: "Embedded Software Engineer", email: "—", phone: "—", externalProfile: "—", employmentType: "—", residence: "Casablanca, Morocco", extraBenefits: "Java", category: "ICT (+1)", subCategory: "Software Development", functions: "Embedded Systems Development", seniority: "medior (+1)", skills: "Python 4/5; Agile Methodologies 4/5; Unit Testing", languages: "Arabic 5/5; English 4/5; French 4/5", notes: "No", lastNote: "—", yearsExperience: "4 years", companies: "Vitesco Technologies", schools: "Faculté Des Sciences Et", degree: "Master's; Bachelor's", hasLinkedJob: true },
  { id: "89949328", firstName: "hussain", lastName: "ahmed", workType: "Permanent", jobTitle: "Senior Backend Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "—", residence: "Pakistan", extraBenefits: "Java", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "PHP 5/5; CodeIgniter 5/5; Laravel 5/5; Java", languages: "English 3/5", notes: "No", lastNote: "—", yearsExperience: "6 years", companies: "Emtiyaz Soft; PixelSoft", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949230", firstName: "hitesh", lastName: "kumar", workType: "Permanent", jobTitle: "Backend Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Kitchener, Canada", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "Python 3/5; JavaScript 3/5; TypeScript 3/5", languages: "English 4/5", notes: "No", lastNote: "—", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949200", firstName: "aleksey", lastName: "zhylko", workType: "Permanent", jobTitle: "Senior PHP Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Kyiv, Ukraine", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "PHP 5/5; Laravel 4/5; Symfony 3/5; MySQL", languages: "English 4/5; Russian 4/5", notes: "No", lastNote: "—", yearsExperience: "6 years", companies: "Sportlabs Group; Vseos", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949422", firstName: "oleksandr", lastName: "t", workType: "Permanent", jobTitle: "Full-Stack Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Ukraine", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Full-Stack Development", seniority: "senior", skills: "PHP 5/5; JavaScript 4/5; SQL 4/5; MySQL 4/5", languages: "English 4/5; Ukrainian 5/5", notes: "Yes", lastNote: "OVERALL ASSESSMENT", yearsExperience: "4 years", companies: "LABELPLATFORM; NEW", schools: "—", degree: "—", hasLinkedJob: true },
  { id: "89949385", firstName: "tuan", lastName: "tuan abdullah", workType: "—", jobTitle: "—", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Malaysia", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "Python 4/5; Java 4/5; JavaScript 4/5; React", languages: "English 4/5", notes: "Yes", lastNote: "OVERALL ASSESSMENT", yearsExperience: "—", companies: "—", schools: "—", degree: "—", hasLinkedJob: false },
  { id: "89949245", firstName: "nikol", lastName: "paraskova", workType: "Permanent", jobTitle: "Junior Backend Developer", email: "—", phone: "—", externalProfile: "LinkedIn profile", employmentType: "permanent", residence: "Sofia, Bulgaria", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "junior", skills: "PHP 5/5; MySQL 4/5; CSS 3/5; HTML 3/5", languages: "English 4/5; Bulgarian 5/5; German 1/5", notes: "Yes", lastNote: "test", yearsExperience: "1 years", companies: "Pontica Solutions; Trad", schools: "University of Lincoln", degree: "Master of Science; Bachelor's", hasLinkedJob: true },
  { id: "89949560", firstName: "Radouane", lastName: "Ouledmoussa", workType: "Permanent", jobTitle: "Senior Java Developer", email: "—", phone: "—", externalProfile: "—", employmentType: "permanent", residence: "Morocco", extraBenefits: "—", category: "ICT", subCategory: "Software Development", functions: "Backend Development", seniority: "senior", skills: "Java 5/5; Spring Boot 4/5; Jenkins 4/5; Oracle", languages: "Arabic 5/5; French 5/5; English 4/5; German", notes: "Yes", lastNote: "OVERALL ASSESSMENT", yearsExperience: "14 years", companies: "Java Community Process", schools: "Institut Supérieur De Gé", degree: "Multimedia Avionics", hasLinkedJob: true },
];

const columns = ["Id", "First name", "Last name", "Work type", "Job title", "Email address", "Phone number", "External profile", "Employment type", "Residence", "Extra benefits", "Category", "Sub category", "Functions", "Seniority", "Skills", "Languages", "Notes", "Last note", "Years of experience", "Companies", "Schools", "Degree"];

const candidateCell = (value: string, key: string) => (
  <td key={key} style={value === "—" ? { color: "#cbd5e1" } : { maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</td>
);

function CandidateActionsMenu({ candidate, onPropose, onView, autoOpen }: { candidate: Candidate; onPropose: () => void; onView: () => void; autoOpen?: boolean }) {
  const { has } = useHighlight();
  const shouldHighlight = has("schedule") || has("candidates") || has("table-menu");
  const [open, setOpen] = useState(autoOpen && shouldHighlight);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    };
    update();
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const items = [
    { label: "View full profile", icon: Eye, action: onView },
    { label: "Schedule a meeting", icon: CalendarPlus, action: onPropose, highlight: shouldHighlight },
    { label: "Hide permanently", icon: EyeOff },
    { label: "Delete", icon: Trash2 },
    { label: "Send email", icon: Mail },
    { label: "Submit candidate", icon: Send },
    { label: "Resend Activation code", icon: RotateCcw },
  ];

  return (
    <div className="candidate-actions">
      <button ref={btnRef} className={`candidate-menu ${shouldHighlight ? "highlight-pulse" : ""}`} aria-label="Candidate actions" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={15} />
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div ref={menuRef} className="candidate-actions-menu candidate-actions-menu--fixed" role="menu" style={{ top: pos.top, left: pos.left }}>
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <button key={it.label} role="menuitem" className={`${it.highlight ? "highlight-menu-item" : ""}`} onClick={() => { setOpen(false); it.action?.(); }}>
                  <Icon size={15} /> {it.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

export default function PermanentCandidatesPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [drawerCandidate, setDrawerCandidate] = useState<Candidate | null>(null);
  const [slot, setSlot] = useState({ date: "2026-08-05", hour: 18, minute: 0 });
  const [toast, setToast] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return candidates;
    const q = query.toLowerCase();
    return candidates.filter((c) => `${c.firstName} ${c.lastName} ${c.email} ${c.id}`.toLowerCase().includes(q));
  }, [query]);

  const toggleAll = () => setSelected((cur) => (cur.length === filtered.length ? [] : filtered.map((c) => c.id)));
  const toggleOne = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const handlePropose = (c: Candidate) => {
    setSlot(getNextQuarterSlot());
    setDrawerCandidate(c);
  };
  const handleCreate = () => {
    setDrawerCandidate(null);
    setToast("Interview proposed");
    setTimeout(() => setToast(""), 2200);
  };

  const drawerFixedEventType = drawerCandidate ? "Meeting" : undefined;
  const drawerAllowedTypes: ("Interview" | "Candidate meeting" | "Meeting" | "Other")[] | undefined = drawerCandidate ? ["Meeting", "Candidate meeting", "Interview", "Other"] : undefined;

  return (
    <>
        <Header kicker={<>Permanent / Candidates</>} />
        <main className="jobs-page">
          <div className="contacts-title-row">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="jobs-back" onClick={() => router.back()} aria-label="Back">
                <ChevronLeft size={18} />
              </button>
              <h1>Search candidates</h1>
              <a href="#" style={{ color: "#0f766e", fontSize: 13, fontWeight: 500, marginLeft: 8, textDecoration: "underline", textUnderlineOffset: 2 }}>
                How does this work?
              </a>
            </div>
            <div className="contacts-title-actions">
              <button className="contacts-process-button" disabled style={{ opacity: 0.5 }}>
                Process candidates
              </button>
              <button className="contacts-add-button">+ Add candidates</button>
            </div>
          </div>

          <div className="jobs-toolbar">
            <label className="jobs-search" style={{ flex: "0 1 520px" }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in name, phone, email & CV content (Boolean strings OK)" />
              <Search size={16} />
            </label>
            <button className="jobs-filters-button">
              <ListFilter size={14} /> Filter
            </button>
            <button className="jobs-filters-button">
              <Bookmark size={14} /> Saved community criteria <ChevronDown size={12} />
            </button>
            <div className="jobs-toolbar-right">
              <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                <button style={{ padding: "6px 8px", background: "#fff", border: 0, borderRight: "1px solid #e2e8f0", color: "#0f766e" }}>
                  <Table2 size={14} />
                </button>
                <button style={{ padding: "6px 8px", background: "#f8fafc", border: 0, color: "#64748b" }}>
                  <LayoutGrid size={14} />
                </button>
              </div>
              <button className="jobs-columns-button">
                <Columns3 size={14} /> Columns <ChevronDown size={12} />
              </button>
            </div>
          </div>

          <p className="jobs-results-count">
            <b>470</b> results in total
          </p>

          <div className="jobs-table-wrap">
            <table className="jobs-table candidates-table">
              <thead>
                <tr>
                  <th className="candidates-check-col">
                    <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  {columns.map((col) => (
                    <th key={col}>
                      <span>{col}</span>
                      <ChevronDown size={13} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={selected.includes(c.id) ? "selected" : ""}
                    onClick={() => router.push(`/candidates/${c.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="candidates-check-col" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleOne(c.id)} aria-label={`Select ${c.id}`} />
                      <button className="candidate-expand" onClick={() => router.push(`/candidates/${c.id}`)} aria-label="Expand">
                        <Expand size={13} />
                      </button>
                      <CandidateActionsMenu candidate={c} onPropose={() => handlePropose(c)} onView={() => router.push(`/candidates/${c.id}`)} autoOpen={idx === 0} />
                    </td>
                    <td style={{ textAlign: "right", color: "#64748b", fontWeight: 500 }}>{c.id}</td>
                    <td>{c.firstName}</td>
                    <td>{c.lastName}</td>
                    {candidateCell(c.workType, "workType")}
                    {candidateCell(c.jobTitle ?? "—", "jobTitle")}
                    {candidateCell(c.email, "email")}
                    {candidateCell(c.phone, "phone")}
                    {candidateCell(c.externalProfile, "externalProfile")}
                    {candidateCell(c.employmentType, "employmentType")}
                    {candidateCell(c.residence, "residence")}
                    {candidateCell(c.extraBenefits, "extraBenefits")}
                    {candidateCell(c.category, "category")}
                    {candidateCell(c.subCategory, "subCategory")}
                    {candidateCell(c.functions, "functions")}
                    {candidateCell(c.seniority, "seniority")}
                    {candidateCell(c.skills, "skills")}
                    {candidateCell(c.languages, "languages")}
                    {candidateCell(c.notes, "notes")}
                    {candidateCell(c.lastNote, "lastNote")}
                    {candidateCell(c.yearsExperience, "yearsExperience")}
                    {candidateCell(c.companies, "companies")}
                    {candidateCell(c.schools, "schools")}
                    {candidateCell(c.degree, "degree")}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="jobs-pagination">
            <span className="rows-per-page">
              Rows per page <b>12 <ChevronDown size={13} /></b>
            </span>
            <div className="pagination-pages">
              <button aria-label="Previous page" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={15} />
              </button>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} className={page === n ? "active" : ""} onClick={() => setPage(n)}>
                  {n}
                </button>
              ))}
              <span>…</span>
              <button onClick={() => setPage(68)}>68</button>
              <button onClick={() => setPage(69)}>69</button>
              <button aria-label="Next page" disabled={page === 69} onClick={() => setPage((p) => Math.min(69, p + 1))}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </main>
      <EventDrawer open={!!drawerCandidate} onClose={() => setDrawerCandidate(null)} slot={slot} onCreate={handleCreate} initialLinkedRecords={drawerCandidate ? [{ type: "Candidate" as const, item: { id: drawerCandidate.id, name: `${drawerCandidate.firstName} ${drawerCandidate.lastName}`, email: drawerCandidate.email, avatar: "" } }] : undefined} fixedEventType={drawerFixedEventType} allowedEventTypes={drawerAllowedTypes as any} />
      <div className={`toast ${toast ? "shown" : ""}`}>{toast}</div>
    </>
  );
}