"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

/** Rows-per-page + numbered pagination, matching .jobs-pagination styles. */
export function Pagination({
  page,
  pages,
  onPage,
  rowsPerPage = 24,
}: {
  page: number;
  /** Page numbers to render (can include "…" as a string). */
  pages: (number | string)[];
  onPage: (page: number) => void;
  rowsPerPage?: number | ReactNode;
}) {
  const numeric = pages.filter((p): p is number => typeof p === "number");
  const last = numeric[numeric.length - 1] ?? 1;
  return (
    <div className="jobs-pagination">
      <span className="rows-per-page">
        Rows per page <b>{rowsPerPage} <ChevronDown size={13} /></b>
      </span>
      <div className="pagination-pages">
        <button aria-label="Previous page" disabled={page === 1} onClick={() => onPage(Math.max(1, page - 1))} type="button">
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) =>
          typeof p === "string" ? (
            <span key={`sep-${i}`}>{p}</span>
          ) : (
            <button key={p} className={page === p ? "active" : ""} onClick={() => onPage(p)} type="button">
              {p}
            </button>
          )
        )}
        <button aria-label="Next page" disabled={page === last} onClick={() => onPage(Math.min(last, page + 1))} type="button">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
