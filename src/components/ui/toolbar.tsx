"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

/**
 * Standard list-page toolbar: search input + optional filter button + right-side actions slot.
 * Reuses .jobs-toolbar / .jobs-search / .jobs-filters-button styles.
 */
export function SearchToolbar({
  placeholder,
  value,
  onChange,
  filterLabel,
  onFilter,
  children,
  searchFlex,
}: {
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  filterLabel?: string;
  onFilter?: () => void;
  /** Right-side slot (download, columns, primary action…). */
  children?: ReactNode;
  searchFlex?: string;
}) {
  return (
    <div className="jobs-toolbar" style={{ marginTop: 0, padding: "0 2px", width: "100%", minWidth: 0, flexShrink: 0 }}>
      <label className="jobs-search" style={searchFlex ? { flex: searchFlex } : undefined}>
        <input type="text" placeholder={placeholder} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} />
        <Search size={16} />
      </label>
      {filterLabel && (
        <button className="jobs-filters-button" type="button" onClick={onFilter}>
          {filterLabel}
        </button>
      )}
      {children && <div className="jobs-toolbar-right">{children}</div>}
    </div>
  );
}
