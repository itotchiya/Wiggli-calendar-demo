"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

const tabs = [
  { label: "Jobs", href: "/jobs" },
  { label: "Candidates", href: "/jobs/candidates" },
  { label: "Interviews", href: "/jobs/interviews" },
  { label: "Offers" },
];

export function JobsPageHeader({ activeTab, actions }: { activeTab: string; actions?: ReactNode }) {
  const router = useRouter();

  return (
    <>
      <div className="jobs-title-row">
        <button className="jobs-back" aria-label="Back" onClick={() => router.back()}>
          <ChevronLeft size={20} />
        </button>
        <h1>Jobs</h1>
        <div className="jobs-title-actions">{actions}</div>
      </div>
      <div className="jobs-tabs" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.label === activeTab;
          const className = isActive ? "active" : "";
          return tab.href ? (
            <Link key={tab.label} href={tab.href} role="tab" aria-selected={isActive} className={className}>
              {tab.label}
            </Link>
          ) : (
            <button key={tab.label} role="tab" aria-selected={false} className={className}>
              {tab.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
