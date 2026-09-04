"use client";

import type { LucideIcon } from "lucide-react";

export type TabDef = {
  label: string;
  icon?: LucideIcon;
  isNew?: boolean;
};

/**
 * Underline tablist for detail pages.
 * variant "contact" → .contact-detail-tabs, variant "job" → .job-tabs.
 * `clickable`: which labels are interactive (others render as inert).
 */
export function DetailTabs({
  tabs,
  active,
  onChange,
  variant = "contact",
  clickable,
  trailing,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (label: string) => void;
  variant?: "contact" | "job";
  clickable?: (label: string) => boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={variant === "job" ? "job-tabs" : "contact-detail-tabs"} role="tablist" style={variant === "job" ? { flexShrink: 0, width: "100%", minWidth: 0 } : undefined}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isClickable = clickable ? clickable(tab.label) : true;
        return (
          <button
            key={tab.label}
            role="tab"
            aria-selected={tab.label === active}
            className={tab.label === active ? "active" : ""}
            onClick={() => { if (isClickable) onChange(tab.label); }}
            style={{ cursor: isClickable ? "pointer" : "default" }}
            aria-disabled={!isClickable}
            type="button"
          >
            {Icon && <Icon size={15} />} {tab.label}{tab.isNew && <span className="detail-tab-new-badge">NEW</span>}
          </button>
        );
      })}
      {trailing}
    </div>
  );
}
