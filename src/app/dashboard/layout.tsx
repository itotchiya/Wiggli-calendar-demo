"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { CalendarDays } from "lucide-react";
import { GoogleSessionAction, Sidebar } from "@/components/chrome";
import { SidebarProvider } from "@/components/sidebar-context";

function Inner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const calendarView = pathname === "/dashboard/calendar";

  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        pathname === href
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        {!calendarView && (
          <>
            <header className="border-b bg-background">
              <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
                <Link href="/dashboard/calendar" className="flex items-center gap-2 font-semibold tracking-tight">
                  <CalendarDays className="size-5 text-primary" />
                  Wiggli <span className="font-normal text-muted-foreground">Calendar</span>
                </Link>
                {session && (
                  <nav className="flex items-center gap-1">
                    {link("/dashboard/calendar", "Calendar")}
                    {link("/dashboard/create", "Create event")}
                    {link("/dashboard/drawer", "Event drawer")}
                    {link("/dashboard/native", "Native invites")}
                    {link("/dashboard/events", "Events & RSVPs")}
                  </nav>
                )}
                <div className="ml-auto flex items-center gap-2 text-sm">
                  {session?.user?.email && <span className="text-muted-foreground">{session.user.email}</span>}
                  <GoogleSessionAction />
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          </>
        )}
        {calendarView && children}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
      <SidebarProvider><Inner>{children}</Inner></SidebarProvider>
    </SessionProvider>
  );
}
