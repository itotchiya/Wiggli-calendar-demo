"use client";

import { useCallback, useEffect, useState } from "react";

export type Suite = "google" | "outlook";

export type Integrations = {
  suite: Suite;
  emailSynced: Record<Suite, boolean>;
  calendarSynced: Record<Suite, boolean>;
  zoomConnected: boolean;
};

export const defaultIntegrations: Integrations = {
  suite: "google",
  emailSynced: { google: false, outlook: false },
  calendarSynced: { google: false, outlook: false },
  zoomConnected: false,
};

const STORAGE_KEY = "wiggli-integrations";
const CHANGE_EVENT = "wiggli-integrations-change";

export function loadIntegrations(): Integrations {
  if (typeof window === "undefined") return defaultIntegrations;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultIntegrations;
    const parsed = JSON.parse(raw) as Partial<Integrations>;
    return {
      suite: parsed.suite === "outlook" ? "outlook" : "google",
      emailSynced: { ...defaultIntegrations.emailSynced, ...(parsed.emailSynced ?? {}) },
      calendarSynced: { ...defaultIntegrations.calendarSynced, ...(parsed.calendarSynced ?? {}) },
      zoomConnected: Boolean(parsed.zoomConnected),
    };
  } catch {
    return defaultIntegrations;
  }
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integrations>(defaultIntegrations);

  useEffect(() => {
    const sync = () => setIntegrations(loadIntegrations());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const updateIntegrations = useCallback((updater: (current: Integrations) => Integrations) => {
    const next = updater(loadIntegrations());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setIntegrations(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [integrations, updateIntegrations] as const;
}
