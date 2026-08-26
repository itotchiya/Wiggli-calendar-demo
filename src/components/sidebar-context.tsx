"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const SidebarContext = createContext<{
  expanded: boolean;
  setExpanded: (value: boolean) => void;
} | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <SidebarContext.Provider value={{ expanded, setExpanded }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be inside SidebarProvider");
  return context;
}
