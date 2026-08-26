"use client";

import { createPortal } from "react-dom";
import {
  CalendarPlus,
  CircleX,
  FileText,
  Mail,
  MoreHorizontal,
  Send,
  SendHorizontal,
  Star,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHighlight } from "@/lib/highlight";

type VacancyProgressDrawerProps = {
  open: boolean;
  onClose: () => void;
  vacancyTitle?: string;
  onScheduleInterview?: () => void;
};

export function VacancyProgressDrawer({
  open,
  onClose,
  vacancyTitle = "r&d chimistry",
  onScheduleInterview,
}: VacancyProgressDrawerProps) {
  const { has } = useHighlight();
  const shouldHighlight = has("schedule");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Application details");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && shouldHighlight) setMenuOpen(true);
  }, [open, shouldHighlight]);

  useEffect(() => {
    if (!menuOpen) return;
    const update = () => {
      if (!buttonRef.current) return;
      const r = buttonRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.right - 220 });
    };
    update();
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!open) setMenuOpen(false);
  }, [open]);

  const menuItems = [
    { label: "Schedule a meeting", icon: CalendarPlus, action: onScheduleInterview },
    { label: "Propose offer", icon: Send },
    { label: "Add note", icon: FileText },
    { label: "Disqualify candidate", icon: CircleX },
    { label: "Send email", icon: Mail },
    { label: "Score candidate", icon: Star },
    { label: "Submit candidate", icon: SendHorizontal },
  ];

  return (
    <>
      <button
        className={`drawer-scrim ${open ? "visible" : ""}`}
        onClick={onClose}
        aria-label="Close vacancy progress drawer"
        style={{ zIndex: 65 } as React.CSSProperties}
      />
      <aside
        className={`event-drawer ${open ? "open" : ""}`}
        aria-hidden={!open}
        style={{ zIndex: 66 } as React.CSSProperties}
      >
        <div className="drawer-heading">
          <h2>Progress in job</h2>
          <button onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="vacancy-drawer-body">
          {/* Vacancy card */}
          <div className="vacancy-card">
            <div className="vacancy-card-header">
              <h3>{vacancyTitle}</h3>
              <button
                ref={buttonRef}
                className={`vacancy-more-btn ${shouldHighlight ? "highlight-pulse" : ""}`}
                aria-label="Vacancy actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen &&
                pos &&
                typeof document !== "undefined" &&
                createPortal(
                  <div ref={menuRef} className="vacancy-actions-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const isSchedule = item.label === "Schedule a meeting";
                      return (
                        <button
                          key={item.label}
                          role="menuitem"
                          type="button"
                          className={isSchedule && shouldHighlight ? "highlight-menu-item" : ""}
                          onClick={() => {
                            setMenuOpen(false);
                            item.action?.();
                          }}
                        >
                          <Icon size={15} /> {item.label}
                        </button>
                      );
                    })}
                  </div>,
                  document.body
                )}
            </div>
            <div className="vacancy-meta">
              <span className="vacancy-pill">Open for internal use</span>
              <span className="vacancy-by">By Axelle Bastin</span>
              <span className="vacancy-dot">•</span>
              <span className="vacancy-due">Due: 17/08/2026</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="vacancy-tabs" role="tablist">
            {["Application details", "Resume (CV)", "Notes", "AI assessment"].map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={tab === activeTab}
                className={tab === activeTab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Candidate status */}
          <div className="vacancy-status-row">
            <span className="vacancy-status-label">Candidate status</span>
            <span className="vacancy-status-pill">Sourced</span>
          </div>

          <div className="vacancy-sourced-box">Candidate sourced on 03/08/2026 by Axelle Bastin</div>
        </div>
      </aside>
    </>
  );
}
