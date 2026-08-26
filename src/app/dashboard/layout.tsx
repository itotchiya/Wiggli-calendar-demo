"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/chrome";
import { SidebarProvider } from "@/components/sidebar-context";

/**
 * Prototype-style shell: sidebar + topbar live in the pages (via the shared
 * Header component), so no legacy tab navigation here.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  void usePathname; // keep client-side pathname semantics if needed later
  return (
    <SessionProvider>
      <SidebarProvider>
        <div className="app-shell">
          <Sidebar />
          <div className="app-content">{children}</div>
        </div>
      </SidebarProvider>
    </SessionProvider>
  );
}
