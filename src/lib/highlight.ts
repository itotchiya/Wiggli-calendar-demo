"use client";

import { useEffect, useState } from "react";

export function useHighlight() {
  const [active, setActive] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("highlight");
    if (!raw) return;
    const keys = raw.split(",").map((s) => s.trim()).filter(Boolean);
    setActive(new Set(keys));
  }, []);

  const has = (key: string) => active.has(key) || active.has("all");
  const hasAny = (...keys: string[]) => keys.some((k) => has(k));
  return { active, has, hasAny };
}
