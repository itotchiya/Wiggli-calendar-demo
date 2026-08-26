"use client";

import { SessionProvider } from "next-auth/react";
import { Header, Sidebar } from "@/components/chrome";
import { CustomFieldsManager } from "@/components/custom-fields-manager";
import { SidebarProvider } from "@/components/sidebar-context";

export default function PrototypeStyleCustomFieldsPage() {
  return (
    <SessionProvider>
      <SidebarProvider>
        <div className="app-shell">
          <Sidebar />
          <div className="app-content">
            <Header kicker={<><span className="kicker-muted">Settings / </span>Custom Fields Manager</>} />
            <CustomFieldsManager />
          </div>
        </div>
      </SidebarProvider>
    </SessionProvider>
  );
}
