"use client";

import {
  Armchair,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CloudUpload,
  Coins,
  ContactRound,
  FileText,
  Home,
  Hourglass,
  Lightbulb,
  LogIn,
  LogOut,
  Mail,
  MailCheck,
  Mic,
  Plus,
  Settings,
  Target,
  X,
  UsersRound,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";
import { GOOGLE_SESSION_EXPIRED_EVENT } from "@/lib/google-session-client";
import { useSidebar } from "./sidebar-context";

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number }>;
type NavChild = { label: string; href?: string };
type NavItem = { label: string; icon: IconType; href?: string; children?: NavChild[] };

const navItems: NavItem[] = [
  { label: "Home", icon: Home },
  { label: "Tasks", icon: ClipboardList },
  { label: "Jobs", icon: BriefcaseBusiness, href: "/dashboard/jobs" },
  { label: "Permanent", icon: Armchair, children: [{ label: "Candidates", href: "/dashboard/candidates" }, { label: "Notes" }] },
  { label: "Temporary", icon: Hourglass, children: [{ label: "Missions" }, { label: "Timesheets" }] },
  { label: "Organizations", icon: Building2 },
  { label: "Contacts", icon: ContactRound },
  { label: "Opportunities", icon: Target },
  { label: "Placements", icon: FileText },
  { label: "Suppliers", icon: UsersRound, children: [{ label: "Search Suppliers" }, { label: "My Suppliers" }, { label: "Suppliers Management" }] },
  { label: "Calendar", icon: CalendarDays, href: "/dashboard/calendar" },
  { label: "AI Notetaker", icon: Mic, href: "/dashboard/notetaker" },
  { label: "Settings", icon: Settings, children: [{ label: "My Profile" }, { label: "Users & Departments" }, { label: "Email Templates" }, { label: "Custom Fields Manager" }] },
  { label: "Emailing (Testing)", icon: MailCheck },
];

export function WLogo({ full = false }: { full?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="Wiggli">
      <Image src="/wiggli-logo.png" alt="Wiggli" width={26} height={24} style={{ objectFit: "contain", display: "block" }} />
      {full && <span className="brand-name">wiggli</span>}
    </div>
  );
}

export function Sidebar() {
  const { expanded, setExpanded } = useSidebar();
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const toggleGroup = (label: string) => {
    setOpenGroups((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    );
  };

  return (
    <motion.aside
      className={`app-sidebar ${expanded ? "expanded" : ""}`}
      initial={false}
      animate={{ width: expanded ? 280 : 64 }}
      transition={{ type: "spring", stiffness: 340, damping: 30, mass: 0.8 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { setExpanded(false); setOpenGroups([]); }}
    >
      <div className="sidebar-logo">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={expanded ? "full" : "icon"}
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(8px)" }}
          >
            <WLogo full={expanded} />
          </motion.div>
        </AnimatePresence>
      </div>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
           const active = item.href
             ? pathname.startsWith(item.href)
             : item.label === "Settings" && (pathname.startsWith("/settings") || pathname.startsWith("/dashboard/settings"));
          const open = openGroups.includes(item.label);
          const content = (
            <>
              {expanded && <span style={{ width: 16, display: "grid", placeItems: "center", flex: "none", color: "#8a9ab0" }}>{item.children && <ChevronRight size={12} style={{ transform: open ? "rotate(90deg)" : undefined }} />}</span>}
              <span className="nav-icon"><Icon size={18} strokeWidth={1.6} /></span>
              {expanded && <span className="nav-label">{item.label}</span>}
            </>
          );
          return (
            <div className="nav-group" key={item.label}>
              {item.href ? (
                <Link href={item.href} className={`nav-item ${active ? "active" : ""}`}>{content}</Link>
              ) : (
                <button className="nav-item" onClick={() => item.children ? toggleGroup(item.label) : undefined}>{content}</button>
              )}
              {expanded && item.children && open && (
                <div className="nav-children">
                  {item.children.map((child) =>
                    child.href ? (
                      <Link key={child.label} href={child.href} className={pathname.startsWith(child.href) ? "active" : ""}>{child.label}</Link>
                    ) : (
                      <button key={child.label} type="button">{child.label}</button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </motion.aside>
  );
}

export function GoogleSessionAction() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [clientAuthError, setClientAuthError] = useState<string | null>(null);
  const authenticated = status === "authenticated" && Boolean(session?.user?.email);
  const expired = Boolean(clientAuthError) || (authenticated && (!session?.accessToken || Boolean(session.error)));
  const connected = authenticated && !expired;
  const connectionClass = expired ? "expired" : connected ? "connected" : "disconnected";

  useEffect(() => {
    const showExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setClientAuthError(detail?.message || "Your Google session expired. Reconnect Google and try again.");
      setOpen(true);
    };
    window.addEventListener(GOOGLE_SESSION_EXPIRED_EVENT, showExpired);
    return () => window.removeEventListener(GOOGLE_SESSION_EXPIRED_EVENT, showExpired);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const handleAuthAction = () => {
    setOpen(false);
    if (connected) {
      void signOut({ callbackUrl: window.location.href });
    } else {
      setClientAuthError(null);
      void signIn("google", { callbackUrl: window.location.href });
    }
  };

  const buttonLabel = status === "loading"
    ? "Checking Google session"
    : expired
      ? "Google session expired"
    : connected
      ? "Google connected"
      : "Google sign-in required";

  return (
    <>
      <button
        type="button"
        className={`google-session-action ${connectionClass}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={buttonLabel}
      >
        <span className="google-session-mark" aria-hidden="true">G</span>
        <span className="google-session-label">{status === "loading" ? "Google" : expired ? "Google expired" : connected ? "Google connected" : "Sign in"}</span>
        <span className="google-session-dot" aria-hidden="true" />
      </button>

      {open && (
        <div className="google-session-scrim" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="google-session-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-session-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="google-session-dialog-header">
              <div>
                <p className="google-session-eyebrow">Calendar connection</p>
                <h2 id="google-session-title">Google session</h2>
              </div>
              <button type="button" className="google-session-close" onClick={() => setOpen(false)} aria-label="Close dialog">
                <X size={18} />
              </button>
            </div>
            <div className={`google-session-status ${connectionClass}`}>
              <span className="google-session-status-dot" aria-hidden="true" />
              <div>
                <strong>{status === "loading" ? "Checking connection" : expired ? "Google authorization expired" : connected ? "Google is signed in" : "Google is signed out"}</strong>
                <p>{expired ? clientAuthError || "Reconnect Google to continue using Calendar and Gmail." : connected ? session?.user?.email : "Sign in again to use Google Calendar and Gmail sync."}</p>
              </div>
            </div>
            <button type="button" className={`google-session-primary ${connected ? "sign-out" : "sign-in"}`} onClick={handleAuthAction} disabled={status === "loading"}>
              {connected ? <LogOut size={16} /> : <LogIn size={16} />}
              {connected ? "Sign out from Google" : expired ? "Reconnect Google" : "Sign in with Google"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}

export function Header({ kicker, onQuickAdd }: { kicker: ReactNode; onQuickAdd?: () => void }) {
  return (
    <header className="topbar">
      <div className="mobile-brand"><WLogo /></div>
      <span className="page-kicker">{kicker}</span>
      <div className="header-actions">
        <button className="icon-button upload" aria-label="Upload"><CloudUpload size={18} /></button>
        <button className="primary-button" onClick={onQuickAdd}><Plus size={16} /> Quick add</button>
        <button className="text-button optional-action"><Lightbulb size={16} /> How-to</button>
        <button className="icon-button optional-action" aria-label="Help"><CircleHelp size={18} /></button>
        <button className="icon-button optional-action" aria-label="Messages"><Mail size={18} /></button>
        <button className="credit-button optional-action"><span><Coins size={16} /></span><i />9000</button>
        <button className="icon-button optional-action" aria-label="Documents"><FileText size={18} /></button>
        <button className="icon-button notification optional-action" aria-label="Notifications"><Bell size={18} /><b /></button>
        <GoogleSessionAction />
      </div>
    </header>
  );
}
