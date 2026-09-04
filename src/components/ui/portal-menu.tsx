"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

export type PortalMenuItem = {
  label: string;
  icon?: LucideIcon;
  action?: () => void;
  danger?: boolean;
  /** Render an uppercase gray section header above this item. */
  group?: string;
};

/**
 * Portal dropdown menu anchored under a trigger button.
 * Tracks scroll/resize, closes on outside pointerdown.
 * `align`: "right" anchors the menu's right edge to the button's right edge.
 */
export function usePortalMenu(): {
  open: boolean;
  setOpen: (v: boolean | ((c: boolean) => boolean)) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  pos: { top: number; left: number } | null;
  alignMenu: (width: number, align?: "left" | "right") => void;
} {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const alignRef = useRef<{ width: number; align: "left" | "right" }>({ width: 224, align: "right" });

  const alignMenu = (width = 224, align: "left" | "right" = "right") => {
    alignRef.current = { width, align };
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: align === "right" ? r.right - width : r.left });
  };

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + 6,
        left: alignRef.current.align === "right" ? r.right - alignRef.current.width : r.left,
      });
    };
    update();
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
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

  return { open, setOpen, triggerRef, menuRef, pos, alignMenu };
}

/** The menu surface itself — render inside the same component that used usePortalMenu. */
export function PortalMenuList({
  open,
  pos,
  menuRef,
  onClose,
  items,
  className = "contact-more-menu",
  children,
}: {
  open: boolean;
  pos: { top: number; left: number } | null;
  menuRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  items?: PortalMenuItem[];
  className?: string;
  children?: ReactNode;
}) {
  if (!open || !pos || typeof document === "undefined") return null;
  return createPortal(
    <div ref={menuRef} className={className} role="menu" style={{ top: pos.top, left: pos.left }}>
      {children ??
        items?.map((item) => {
          const Icon = item.icon;
          return (
            <span key={`${item.group ?? ""}-${item.label}`} style={{ display: "contents" }}>
              {item.group && <span className="contact-more-menu-group">{item.group}</span>}
              <button
                role="menuitem"
                type="button"
                className={item.danger ? "danger" : ""}
                onClick={() => {
                  onClose();
                  item.action?.();
                }}
              >
                {Icon && <Icon size={16} />} {item.label}
              </button>
            </span>
          );
        })}
    </div>,
    document.body
  );
}
