"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import { CalendarDays } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

function Inner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <CalendarDays className="size-5 text-primary" />
            Wiggli <span className="font-normal text-muted-foreground">Calendar</span>
          </Link>
          {session && (
            <nav className="flex items-center gap-1">
              {link("/dashboard/create", "Create event")}
              {link("/dashboard/drawer", "Event drawer")}
              {link("/dashboard/native", "Native invites")}
              {link("/dashboard/events", "Events & RSVPs")}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2 text-sm">
            {status === "loading" ? (
              <span className="text-muted-foreground">…</span>
            ) : session?.user?.email ? (
              <>
                <span className="text-muted-foreground">{session.user.email}</span>
                <Button variant="outline" size="sm" onClick={() => signOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <a href="/api/auth/signin" className={buttonVariants({ size: "sm" })}>
                Sign in with Google
              </a>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Inner>{children}</Inner>
    </SessionProvider>
  );
}
