"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Info,
  ListFilter,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Header } from "@/components/chrome";
import { jobs } from "./data";
import { JobsPageHeader } from "./ui";

const stats = [
  { label: "Total jobs", value: "60", sub: "Job", highlight: false },
  { label: "Applications", value: "0", sub: "Applicants", highlight: false },
  { label: "Sourced", value: "817", sub: "Candidates", highlight: true },
  { label: "Interviews", value: "1", sub: "Interviews", highlight: false },
  { label: "Offers", value: "0", sub: "Offers sent", highlight: false },
  { label: "Hired", value: "0", sub: "Candidates", highlight: false },
  { label: "Rejected", value: "61", sub: "Candidates", highlight: false },
];

const columns = [
  "Reference",
  "Job title",
  "Job type",
  "Site",
  "Department",
  "Category",
  "Sub category",
  "Education level",
  "Languages",
  "Employment type",
  "Job location",
  "Payroll country",
  "Currency",
  "Payment",
];

type ExtraCell = {
  education: string;
  languages: string[];
  employment: string;
  location: string;
  payroll: string;
  currency: string;
  payment: string;
};

const extraData: Record<number, ExtraCell> = {
  1628: { education: "", languages: ["French 3/5"], employment: "—", location: "place Maréchal 351 125...", payroll: "—", currency: "—", payment: "" },
  1627: { education: "or", languages: ["French 3/5"], employment: "Permanent", location: "place Maréchal 351 125...", payroll: "Belgium", currency: "EUR", payment: "monthly" },
  1614: { education: "", languages: ["French 3/5", "German 3/5"], employment: "—", location: "place Maréchal 351 125...", payroll: "—", currency: "—", payment: "" },
  1607: { education: "", languages: ["French 5/5"], employment: "Fixed term", location: "place Maréchal 351 125...", payroll: "Belgium", currency: "EUR", payment: "monthly" },
  1597: { education: "or", languages: ["English 4/5"], employment: "Permanent", location: "place Maréchal 351 125...", payroll: "France", currency: "EUR", payment: "monthly" },
  1596: { education: "", languages: ["French 3/5"], employment: "Permanent", location: "place Maréchal 351 125...", payroll: "Belgium", currency: "EUR", payment: "monthly" },
  1594: { education: "—", languages: [], employment: "—", location: "—", payroll: "—", currency: "—", payment: "" },
  1567: { education: "", languages: ["French 3/5"], employment: "Permanent", location: "place Maréchal 351 125...", payroll: "Belgium", currency: "EUR", payment: "monthly" },
  1553: { education: "pecified", languages: ["English 3/5"], employment: "Permanent", location: "place Maréchal 351 125...", payroll: "Belgium", currency: "EUR", payment: "yearly" },
};

export default function JobsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const rowsPerPage = 24;

  return (
    <>
        <Header kicker={<><span className="kicker-muted">Permanent / </span>Jobs</>} />
        <main className="jobs-page">
          <JobsPageHeader
            activeTab="Jobs"
            actions={<button className="create-job-button"><Plus size={16} /> Create a job</button>}
          />

          <div className="jobs-stats">
            <span className="jobs-stats-info"><Info size={12} /></span>
            <div className="jobs-stat-card first">
              <span className="jobs-stat-label">Total jobs</span>
              <span className="jobs-stat-value">60</span>
              <span className="jobs-stat-sub">Job</span>
            </div>
            <span className="jobs-stat-chevron" aria-hidden="true" />
            <div className="jobs-stat-card jobs-stat-card--combined">
              <div className="jobs-stat-split">
                <div className="jobs-stat-split-item">
                  <span className="jobs-stat-label">Applications</span>
                  <span className="jobs-stat-value">0</span>
                  <span className="jobs-stat-sub">Applicants</span>
                </div>
                <span className="jobs-stat-divider" aria-hidden="true" />
                <div className="jobs-stat-split-item">
                  <span className="jobs-stat-label jobs-stat-label--active">Sourced</span>
                  <span className="jobs-stat-value highlight">817</span>
                  <span className="jobs-stat-sub">Candidates</span>
                </div>
              </div>
            </div>
            <span className="jobs-stat-chevron" aria-hidden="true" />
            <div className="jobs-stat-card">
              <span className="jobs-stat-label">Interviews</span>
              <span className="jobs-stat-value">1</span>
              <span className="jobs-stat-sub">Interviews</span>
            </div>
            <span className="jobs-stat-chevron" aria-hidden="true" />
            <div className="jobs-stat-card">
              <span className="jobs-stat-label">Offers</span>
              <span className="jobs-stat-value">0</span>
              <span className="jobs-stat-sub">Offers sent</span>
            </div>
            <span className="jobs-stat-chevron" aria-hidden="true" />
            <div className="jobs-stat-card">
              <span className="jobs-stat-label">Hired</span>
              <span className="jobs-stat-value">0</span>
              <span className="jobs-stat-sub">Candidates</span>
            </div>
            <span className="jobs-stat-vdivider" aria-hidden="true" />
            <div className="jobs-stat-card last">
              <span className="jobs-stat-label">Rejected</span>
              <span className="jobs-stat-value">61</span>
              <span className="jobs-stat-sub">Candidates</span>
            </div>
          </div>

          <div className="jobs-toolbar">
            <label className="jobs-search">
              <input type="text" placeholder="Search in (Ref, job title, description)" />
              <Search size={16} />
            </label>
            <button className="jobs-filters-button">
              <ListFilter size={16} /> Filters
            </button>
            <div className="jobs-toolbar-right">
              <button className="icon-button" aria-label="Download"><Download size={16} /></button>
              <button className="jobs-columns-button"><Columns3 size={16} /> Columns <ChevronDown size={14} /></button>
            </div>
          </div>

          <p className="jobs-results-count"><b>60</b> results in total</p>

          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th className="jobs-table-menu-col" style={{width:72, minWidth:72, maxWidth:72}}><div style={{display:"flex", alignItems:"center", justifyContent:"center"}}><input type="checkbox" aria-label="Select all" style={{width:16, height:16, accentColor:"#0f766e"}} /></div></th>
                  {columns.map((column) => (
                    <th key={column}>
                      <span>{column}</span>
                      <ChevronDown size={13} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const extra = extraData[job.reference] ?? { education: "", languages: [], employment: "—", location: "—", payroll: "—", currency: "—", payment: "" };
                  return (
                    <tr key={job.reference} onClick={() => router.push(`/jobs/${job.reference}`)}>
                      <td className="jobs-table-menu-col" onClick={(event) => event.stopPropagation()} style={{width:72, minWidth:72, maxWidth:72}}><div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:8}}><input type="checkbox" aria-label="Select row" style={{width:16, height:16, accentColor:"#0f766e"}} /><button aria-label={`Actions for ${job.title}`} style={{border:0, background:"transparent", cursor:"pointer", color:"var(--muted)", display:"grid", placeItems:"center", padding:2, width:24, height:24}}><MoreHorizontal size={16} /></button></div>
                      </td>
                      <td className="jobs-ref">{job.reference}</td>
                      <td>{job.title}</td>
                      <td>{job.type}</td>
                      <td>{job.site}</td>
                      <td>{job.department}</td>
                      <td>{job.category}</td>
                      <td>{job.subCategory}</td>
                      <td className={extra.education === "—" || extra.education === "" ? "jobs-cell-muted" : ""}>{extra.education || <span className="jobs-cell-muted">—</span>}</td>
                      <td>
                        {extra.languages.length ? (
                          extra.languages.map((lang) => (
                            <span key={lang} className="jobs-lang-pill">
                              {lang}
                            </span>
                          ))
                        ) : (
                          <span className="jobs-cell-muted">—</span>
                        )}
                      </td>
                      <td className={extra.employment === "—" ? "jobs-cell-muted" : ""}>{extra.employment || <span className="jobs-cell-muted">—</span>}</td>
                      <td>
                        <span className="jobs-location">{extra.location || <span className="jobs-cell-muted">—</span>}</span>
                      </td>
                      <td className={extra.payroll === "—" ? "jobs-cell-muted" : ""}>{extra.payroll || <span className="jobs-cell-muted">—</span>}</td>
                      <td className={extra.currency === "—" ? "jobs-cell-muted" : ""}>{extra.currency || <span className="jobs-cell-muted">—</span>}</td>
                      <td>{extra.payment || <span className="jobs-cell-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="jobs-pagination">
            <span className="rows-per-page">
              Rows per page <button className="rows-per-page-button">24 <ChevronDown size={12} /></button>
            </span>
            <div className="pagination-pages">
              <button aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                <ChevronLeft size={16} />
              </button>
              {[1, 2, 3].map((number) => (
                <button key={number} className={page === number ? "active" : ""} onClick={() => setPage(number)}>
                  {number}
                </button>
              ))}
              <button aria-label="Next page" disabled={page === 3} onClick={() => setPage((current) => Math.min(3, current + 1))}>
                <ChevronRight size={16} />
              </button>
            </div>
            <span style={{ width: 110 }} aria-hidden="true" />
          </div>
        </main>
        </>
  );
}
