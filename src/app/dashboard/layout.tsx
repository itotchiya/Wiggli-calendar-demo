"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/chrome";
import { SidebarProvider } from "@/components/sidebar-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
      <SidebarProvider>
        <div className="app-shell">
          <Sidebar />
          <div className="app-content">{children}</div>
        </div>
      </SidebarProvider>
    </SessionProvider>
  );
}
