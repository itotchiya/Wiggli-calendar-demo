"use client";

import { useCallback, useEffect, useState } from "react";

export type EventTypeDefinition = {
  id: string;
  name: string;
  description: string;
};

export const defaultEventTypes: EventTypeDefinition[] = [
  { id: "meeting", name: "Meeting", description: "A general discussion to share information, align on a topic, or agree on next steps." },
  { id: "call", name: "Call", description: "A phone conversation to discuss, clarify, or follow up on a specific topic." },
  { id: "interview", name: "Interview", description: "A structured conversation to evaluate a candidate's experience and suitability for a job opportunity." },
  { id: "job-intake", name: "Job intake", description: "A discussion to gather requirements, responsibilities, expectations, and hiring needs for a job opening." },
];

/** Keep event labels consistent wherever records are rendered in the product. */
export function normalizeEventType(value?: string | null): string {
  const type = value?.trim().toLowerCase();
  if (!type) return "Meeting";
  if (type === "interview" || type.includes("interview")) return "Interview";
  if (type === "call" || type.includes("call")) return "Call";
  if (type === "job intake" || type === "job-intake" || type.includes("job intake")) return "Job intake";
  if (type === "meeting" || type.includes("meeting")) return "Meeting";
  return value!.trim();
}

const STORAGE_KEY = "wiggli-event-types:v3";
const PREVIOUS_STORAGE_KEY = "wiggli-event-types:v2";
const LEGACY_STORAGE_KEY = "wiggli-event-types:v1";
const CHANGE_EVENT = "wiggli-event-types-change";
const LEGACY_DEFAULT_IDS = new Set([
  "meeting",
  "screening-call",
  "interview",
  "candidate-meeting",
  "client-meeting",
  "job-intake",
  "follow-up",
]);

const cloneDefaults = () => defaultEventTypes.map((item) => ({ ...item }));

function sanitizeEventTypes(value: unknown): EventTypeDefinition[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<EventTypeDefinition>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
    const normalizedName = name.toLowerCase();
    if (!id || !name || seenIds.has(id) || seenNames.has(normalizedName)) return [];
    seenIds.add(id);
    seenNames.add(normalizedName);
    return [{ id, name, description }];
  });
}

function normalizeEventTypes(value: unknown): EventTypeDefinition[] {
  const normalized = sanitizeEventTypes(value);
  return normalized.length > 0 ? normalized : cloneDefaults();
}

function migrateLegacyEventTypes(value: unknown): EventTypeDefinition[] {
  const customTypes = sanitizeEventTypes(value).filter((item) => !LEGACY_DEFAULT_IDS.has(item.id));
  return normalizeEventTypes([...cloneDefaults(), ...customTypes]);
}

function migrateCurrentEventTypes(value: unknown): EventTypeDefinition[] {
  const existing = sanitizeEventTypes(value);
  const customTypes = existing.filter((item) => !defaultEventTypes.some((defaultType) => defaultType.id === item.id));
  return normalizeEventTypes([...cloneDefaults(), ...customTypes]);
}

export function loadEventTypes(): EventTypeDefinition[] {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeEventTypes(JSON.parse(raw));
    const previousRaw = window.localStorage.getItem(PREVIOUS_STORAGE_KEY);
    if (previousRaw) {
      const migrated = migrateCurrentEventTypes(JSON.parse(previousRaw));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return cloneDefaults();
    const migrated = migrateLegacyEventTypes(JSON.parse(legacyRaw));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return cloneDefaults();
  }
}

export function saveEventTypes(types: EventTypeDefinition[]) {
  const normalized = normalizeEventTypes(types);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return normalized;
}

export function useEventTypes() {
  const [eventTypes, setEventTypes] = useState<EventTypeDefinition[]>(cloneDefaults);

  useEffect(() => {
    const sync = () => setEventTypes(loadEventTypes());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const updateEventTypes = useCallback((next: EventTypeDefinition[]) => {
    const saved = saveEventTypes(next);
    setEventTypes(saved);
    return saved;
  }, []);

  return [eventTypes, updateEventTypes] as const;
}
