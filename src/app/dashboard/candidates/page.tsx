"use client";

import {
  Bookmark,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  Columns3,
  Expand,
  Eye,
  EyeOff,
  LayoutGrid,
  ListFilter,
  Mail,
  MoreHorizontal,
  RotateCcw,
  Search,
  Send,
  Table2,
  Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/chrome";
import { EventDrawer } from "@/components/event-drawer";
import { usePortalMenu, PortalMenuList } from "@/components/ui/portal-menu";
import { Pagination } from "@/components/ui/pagination";
import { getNextQuarterSlot } from "@/lib/datetime-proto";
import { showToast } from "@/components/toaster";
import { candidateRows, type CandidateListRow } from "../jobs/data";

const columns = ["Id", "First name", "Last name", "Work type", "Job title", "Email address", "Phone number", "External profile", "Employment type", "Residence", "Extra benefits", "Category", "Sub category", "Functions", "Seniority", "Skills", "Languages", "Notes", "Last note", "Years of experience", "Companies", "Schools", "Degree"];

const candidateCell = (value: string, key: string) => (
  <td key={key} style={value === "—" ? { color: "#cbd5e1" } : { maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</td>
);

function CandidateActionsMenu({ candidate, onPropose, onView }: { candidate: CandidateListRow; onPropose: () => void; onView: () => void }) {
  const menu = usePortalMenu();

  return (
    <div className="candidate-actions">
      <button ref={menu.triggerRef} className="candidate-menu" aria-label="Candidate actions" aria-expanded={menu.open} onClick={() => { menu.alignMenu(212, "left"); menu.setOpen((v) => !v); }} type="button">
        <MoreHorizontal size={15} />
      </button>
      <PortalMenuList
        open={menu.open}
        pos={menu.pos}
        menuRef={menu.menuRef}
        onClose={() => menu.setOpen(false)}
        className="candidate-actions-menu candidate-actions-menu--fixed"
        items={[
          { label: "View full profile", icon: Eye, action: onView },
          { label: "Schedule a meeting", icon: CalendarPlus, action: onPropose },
          { label: "Hide permanently", icon: EyeOff },
          { label: "Delete", icon: Trash2 },
          { label: "Send email", icon: Mail },
          { label: "Submit candidate", icon: Send },
          { label: "Resend Activation code", icon: RotateCcw },
        ]}
      />
    </div>
  );
}

export default function PermanentCandidatesPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [drawerCandidate, setDrawerCandidate] = useState<CandidateListRow | null>(null);
  const [slot, setSlot] = useState(getNextQuarterSlot());

  const filtered = useMemo(() => {
    if (!query.trim()) return candidateRows;
    const q = query.toLowerCase();
    return candidateRows.filter((c) => `${c.firstName} ${c.lastName} ${c.email} ${c.id}`.toLowerCase().includes(q));
  }, [query]);

  const toggleAll = () => setSelected((cur) => (cur.length === filtered.length ? [] : filtered.map((c) => c.id)));
  const toggleOne = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const handlePropose = (c: CandidateListRow) => {
    setSlot(getNextQuarterSlot());
    setDrawerCandidate(c);
  };
  const handleCreate = () => {
    setDrawerCandidate(null);
    showToast("Meeting scheduled — synced to calendar");
  };

  return (
    <>
      <Header kicker={<>Permanent / Candidates</>} />
      <main className="jobs-page">
        <div className="contacts-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="jobs-back" onClick={() => router.back()} aria-label="Back" type="button">
              <ChevronLeft size={18} />
            </button>
            <h1>Search candidates</h1>
          </div>
          <div className="contacts-title-actions">
            <button className="contacts-process-button" disabled style={{ opacity: 0.5 }} type="button">
              Process candidates
            </button>
            <button className="contacts-add-button" type="button">+ Add candidates</button>
          </div>
        </div>

        <div className="jobs-toolbar">
          <label className="jobs-search" style={{ flex: "0 1 520px" }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in name, phone, email & CV content (Boolean strings OK)" />
            <Search size={16} />
          </label>
          <button className="jobs-filters-button" type="button">
            <ListFilter size={14} /> Filter
          </button>
          <button className="jobs-filters-button" type="button">
            <Bookmark size={14} /> Saved community criteria <ChevronDown size={12} />
          </button>
          <div className="jobs-toolbar-right">
            <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <button style={{ padding: "6px 8px", background: "#fff", border: 0, borderRight: "1px solid #e2e8f0", color: "#0f766e" }} type="button">
                <Table2 size={14} />
              </button>
              <button style={{ padding: "6px 8px", background: "#f8fafc", border: 0, color: "#64748b" }} type="button">
                <LayoutGrid size={14} />
              </button>
            </div>
            <button className="jobs-columns-button" type="button">
              <Columns3 size={14} /> Columns <ChevronDown size={12} />
            </button>
          </div>
        </div>

        <p className="jobs-results-count">
          <b>{filtered.length}</b> results in total
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
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={selected.includes(c.id) ? "selected" : ""}
                  onClick={() => router.push(`/dashboard/candidates/${c.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="candidates-check-col" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleOne(c.id)} aria-label={`Select ${c.id}`} />
                    <button className="candidate-expand" onClick={() => router.push(`/dashboard/candidates/${c.id}`)} aria-label="Expand" type="button">
                      <Expand size={13} />
                    </button>
                    <CandidateActionsMenu candidate={c} onPropose={() => handlePropose(c)} onView={() => router.push(`/dashboard/candidates/${c.id}`)} />
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

        <Pagination page={page} pages={[1, 2, 3, 4, "…", 68, 69]} onPage={setPage} rowsPerPage={12} />
      </main>
      <EventDrawer
        open={!!drawerCandidate}
        onClose={() => setDrawerCandidate(null)}
        slot={slot}
        onCreate={handleCreate}
        initialLinkedRecords={drawerCandidate ? [{ type: "Candidate" as const, item: { id: drawerCandidate.id, name: `${drawerCandidate.firstName} ${drawerCandidate.lastName}`, email: drawerCandidate.email, avatar: "" } }] as never : undefined}
        fixedEventType="Meeting"
      />
    </>
  );
}
