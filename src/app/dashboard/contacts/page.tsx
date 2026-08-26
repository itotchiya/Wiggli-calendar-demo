"use client";

import { createPortal } from "react-dom";
import { CalendarPlus, ChevronDown, Columns3, FileText as FileDoc, Mail, MessageSquare, MoreHorizontal, Plus, Search, Send, Trash2, ListFilter, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/chrome";
import { EventDrawer } from "@/components/event-drawer";
import { OrganizationChain } from "@/components/crm/organization-chain";
import { getNextQuarterSlot } from "@/lib/datetime-proto";
import { useHighlight } from "@/lib/highlight";
import { contacts } from "./data";

const columns = ["Name", "Reference", "Status", "Organization", "Role", "Phone Number", "Email", "Linkedin", "Location", "Active Jobs", "Added by", "Created on"];

const contactExtras: Record<number, { linkedin: string; location: string; activeJobs: string; addedBy: string; createdOn: string }> = {
  10000627: { linkedin: "—", location: "—", activeJobs: "1", addedBy: "Axelle Bastin", createdOn: "22/07/2026" },
  10000626: { linkedin: "—", location: "—", activeJobs: "0", addedBy: "Axelle Bastin", createdOn: "24/06/2026" },
  10000625: { linkedin: "—", location: "—", activeJobs: "4", addedBy: "Axelle Bastin", createdOn: "24/06/2026" },
  10000565: { linkedin: "—", location: "—", activeJobs: "1", addedBy: "Axelle Bastin", createdOn: "23/04/2026" },
  10000561: { linkedin: "—", location: "—", activeJobs: "0", addedBy: "Axelle Bastin", createdOn: "23/04/2026" },
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Inactive: "status-pill status-pill--inactive",
    Lead: "status-pill status-pill--lead",
    Active: "status-pill status-pill--active",
  };
  return <span className={map[status] ?? "status-pill"}>{status}</span>;
}

function ContactTableActionsMenu({ contact, onSchedule, autoOpen }: { contact: (typeof contacts)[number]; onSchedule: () => void; autoOpen?: boolean }) {
  const { has } = useHighlight();
  const shouldHighlight = has("schedule") || has("table-menu");
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (autoOpen && shouldHighlight) setOpen(true);
  }, [autoOpen, shouldHighlight]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    };
    update();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <div style={{ display: "inline-flex" }}>
      <button ref={btnRef} className={`candidate-expand ${autoOpen && shouldHighlight ? "highlight-pulse" : ""}`} aria-label="Contact actions" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <MoreHorizontal size={13} />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={menuRef} className="contact-more-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
          <button role="menuitem" onClick={() => { setOpen(false); }}><FileDoc size={18} /> Link organization</button>
          <button role="menuitem" className={shouldHighlight ? "highlight-menu-item" : ""} onClick={() => { setOpen(false); onSchedule(); }}><CalendarPlus size={18} /> Schedule a meeting</button>
          <button role="menuitem" onClick={() => setOpen(false)}><MessageSquare size={18} /> Add note</button>
          <button role="menuitem" onClick={() => setOpen(false)}><Send size={18} style={{ transform: "rotate(-20deg)" }} /> Submit candidate</button>
          <button role="menuitem" className="danger" onClick={() => setOpen(false)}><Trash2 size={18} /> Delete contact</button>
        </div>, document.body
      )}
    </div>
  );
}

export default function ContactsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [scheduleContact, setScheduleContact] = useState<(typeof contacts)[number] | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSlot, setScheduleSlot] = useState({ date: "2026-08-05", hour: 18, minute: 0 });
  const [toast, setToast] = useState("");

  const handleSchedule = (contact: (typeof contacts)[number]) => {
    setScheduleContact(contact);
    setScheduleSlot(getNextQuarterSlot());
    setScheduleOpen(true);
  };
  const handleCreate = () => {
    setScheduleOpen(false);
    setToast(`Meeting with ${scheduleContact?.name ?? "contact"} scheduled`);
    window.setTimeout(() => setToast(""), 2200);
  };

  const toggleAll = () => setSelected((cur) => (cur.length === contacts.length ? [] : contacts.map((c) => c.id)));
  const toggleOne = (id: number) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <>
        <Header kicker={<>Contacts</>} />
        <main className="jobs-page">
          <div className="contacts-title-row">
            <h1>Contacts</h1>
            <div className="contacts-title-actions">
              <button className="contacts-process-button" disabled>
                Process contacts <ChevronDown size={14} />
              </button>
              <button className="contacts-add-button">
                <Plus size={16} /> Add Contact
              </button>
            </div>
          </div>

          <div className="jobs-toolbar">
            <label className="jobs-search">
              <Search size={16} />
              <input type="text" placeholder="Search in ( title, name, description...)" />
            </label>
            <button className="jobs-filters-button">
              <ListFilter size={16} /> Filters
            </button>
            <div className="jobs-toolbar-right">
              <button className="jobs-columns-button">
                <Columns3 size={16} /> Columns <ChevronDown size={14} />
              </button>
            </div>
          </div>

          <div style={{ height: 16 }} aria-hidden="true" />

          <div className="jobs-table-wrap contacts-table-wrap">
            <table className="jobs-table contacts-table">
              <thead>
                <tr>
                  <th className="candidates-check-col contacts-check-col">
                    <input type="checkbox" aria-label="Select all" checked={selected.length === contacts.length} onChange={toggleAll} />
                  </th>
                  {columns.map((col) => (
                    <th key={col}>
                      <span>{col}</span>
                      <ChevronDown size={13} />
                    </th>
                  ))}
                </tr>
              </thead>
              {contacts.map((contact, contactIdx) => (
                <tbody key={contact.id} className={`contact-group ${selected.includes(contact.id) ? "selected" : ""}`}>
                  {contact.orgs.map((orgRow, idx) => (
                    <tr
                      key={`${contact.id}-${idx}`}
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      {idx === 0 && (
                        <>
                          <td className="candidates-check-col contacts-check-col" rowSpan={contact.orgs.length} onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label={`Select ${contact.name}`} checked={selected.includes(contact.id)} onChange={() => toggleOne(contact.id)} />
                            <ContactTableActionsMenu contact={contact} onSchedule={() => handleSchedule(contact)} autoOpen={contactIdx === 0} />
                          </td>
                          <td rowSpan={contact.orgs.length} className="contacts-name-cell">
                            {contact.name}
                          </td>
                          <td rowSpan={contact.orgs.length}>{contact.reference}</td>
                          <td rowSpan={contact.orgs.length}>
                            <StatusPill status={contact.status} />
                          </td>
                        </>
                      )}
                      <td className="contacts-org-cell" onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
                        <OrganizationChain organizations={orgRow.orgs} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
                        {orgRow.role}
                      </td>
                      {idx === 0 && (
                        <>
                          <td rowSpan={contact.orgs.length} className={contact.phone === "—" ? "jobs-cell-muted contacts-phone-cell" : "contacts-phone-cell"}>
                            {contact.phone}
                          </td>
                          <td rowSpan={contact.orgs.length} className="contacts-email-cell">
                            {contact.email}
                          </td>
                          <td rowSpan={contact.orgs.length} className="jobs-cell-muted">
                            {contactExtras[contact.id]?.linkedin ?? "—"}
                          </td>
                          <td rowSpan={contact.orgs.length} className="jobs-cell-muted">
                            {contactExtras[contact.id]?.location ?? "—"}
                          </td>
                          <td rowSpan={contact.orgs.length}>{contactExtras[contact.id]?.activeJobs ?? "—"}</td>
                          <td rowSpan={contact.orgs.length}>{contactExtras[contact.id]?.addedBy ?? "—"}</td>
                          <td rowSpan={contact.orgs.length}>{contactExtras[contact.id]?.createdOn ?? "—"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <div className="jobs-pagination">
            <span className="rows-per-page">
              Rows per page{" "}
              <button className="rows-per-page-button">
                12 <ChevronDown size={12} />
              </button>
            </span>
            <div className="pagination-pages">
              <button aria-label="Previous" disabled={page === 1} onClick={() => setPage((c) => Math.max(1, c - 1))}>
                <ChevronLeft size={16} />
              </button>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} className={page === n ? "active" : ""} onClick={() => setPage(n)}>
                  {n}
                </button>
              ))}
              <span>…</span>
              <button>68</button>
              <button>69</button>
              <button aria-label="Next" disabled={page === 4} onClick={() => setPage((c) => Math.min(4, c + 1))}>
                <ChevronRight size={16} />
              </button>
            </div>
            <span style={{ width: 110 }} aria-hidden="true" />
          </div>
        </main>
        <EventDrawer
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          slot={scheduleSlot}
          onCreate={handleCreate}
          initialLinkedRecords={scheduleContact ? [{ type: "Contact" as const, item: { id: String(scheduleContact.id), name: scheduleContact.name, email: scheduleContact.email, avatar: scheduleContact.avatar } }] : undefined}
          fixedEventType="Meeting"
        />
        <div className={`toast ${toast ? "shown" : ""}`}>{toast}</div>
        </>
  );
}
