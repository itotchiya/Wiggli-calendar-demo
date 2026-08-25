"use client";

import { useCallback, useEffect, useState } from "react";

export type EventTypeDefinition = {
  id: string;
  name: string;
  description: string;
};

export const defaultEventTypes: EventTypeDefinition[] = [
  { id: "meeting", name: "Meeting", description: "A general meeting with internal or external attendees" },
  { id: "screening-call", name: "Screening call", description: "An initial conversation to learn more about a candidate" },
  { id: "interview", name: "Interview", description: "A formal interview to evaluate a candidate for a job" },
  { id: "candidate-meeting", name: "Candidate meeting", description: "A non-interview discussion with a candidate" },
  { id: "client-meeting", name: "Client meeting", description: "A general discussion with a client or contact" },
  { id: "job-intake", name: "Job intake", description: "A meeting to discuss a job's requirements" },
  { id: "follow-up", name: "Follow-up", description: "A discussion after a previous meeting" },
];

const STORAGE_KEY = "wiggli-event-types:v1";
const CHANGE_EVENT = "wiggli-event-types-change";

const cloneDefaults = () => defaultEventTypes.map((item) => ({ ...item }));

function normalizeEventTypes(value: unknown): EventTypeDefinition[] {
  if (!Array.isArray(value)) return cloneDefaults();
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const normalized = value.flatMap((item) => {
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
  return normalized.length > 0 ? normalized : cloneDefaults();
}

export function loadEventTypes(): EventTypeDefinition[] {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeEventTypes(JSON.parse(raw)) : cloneDefaults();
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
