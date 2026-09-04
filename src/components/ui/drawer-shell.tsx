"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Right-side drawer shell: scrim + sliding aside + heading with close button.
 * Reuses the shared .event-drawer / .drawer-scrim / .drawer-heading styles.
 */
export function DrawerShell({
  open,
  onClose,
  title,
  children,
  zIndex = 65,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Base z-index for the scrim; the panel sits at zIndex + 1. */
  zIndex?: number;
  ariaLabel?: string;
}) {
  return (
    <>
      <button
        className={`drawer-scrim ${open ? "visible" : ""}`}
        onClick={onClose}
        aria-label={ariaLabel ?? "Close drawer"}
        style={{ zIndex } as React.CSSProperties}
      />
      <aside className={`event-drawer ${open ? "open" : ""}`} aria-hidden={!open} style={{ zIndex: zIndex + 1 } as React.CSSProperties}>
        <div className="drawer-heading">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Close" type="button">
            <X size={17} />
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
