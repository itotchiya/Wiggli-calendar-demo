"use client";

import { CalendarDays, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { loadEventTypes, useEventTypes, type EventTypeDefinition } from "@/lib/event-types";
import { showToast } from "@/components/toaster";
import styles from "./custom-fields-manager.module.css";

const categories = [
  "Job Opening",
  "Job Closing",
  "Job Priority",
  "Candidate Rejection",
  "Job File Type",
  "CRM File Type",
  "Note Type",
  "Job Type",
  "Job Commitment",
  "Work Type",
  "Organization Status",
  "Opportunity Status",
  "Contact Status",
  "Event Type",
];

function DeleteDialog({ option, onCancel, onConfirm }: { option: EventTypeDefinition; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className={styles.dialogScrim} onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-option-title" aria-describedby="delete-option-description">
        <header>
          <h2 id="delete-option-title">Delete Option</h2>
          <button type="button" onClick={onCancel} aria-label="Close"><X size={24} /></button>
        </header>
        <p id="delete-option-description">Are you sure you want to delete <strong>{option.name || "this option"}</strong>?</p>
        <footer>
          <button className={styles.cancelButton} type="button" onClick={onCancel}>Cancel</button>
          <button className={styles.confirmDelete} type="button" onClick={onConfirm}><Trash2 size={17} /> Delete</button>
        </footer>
      </section>
    </div>
  );
}

function SortableOption({ option, dragging, onChange, onDelete, onDragStart, onDragOver, onDrop }: {
  option: EventTypeDefinition;
  dragging: boolean;
  onChange: (patch: Partial<EventTypeDefinition>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
}) {
  return (
    <div
      className={`${styles.optionRow} ${dragging ? styles.dragging : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button className={styles.dragHandle} type="button" aria-label={`Reorder ${option.name || "event type"}`}>
        <GripVertical size={19} />
      </button>
      <input
        value={option.name}
        maxLength={50}
        onChange={(event) => onChange({ name: event.target.value })}
        aria-label="Event type name"
      />
      <input
        value={option.description}
        maxLength={500}
        onChange={(event) => onChange({ description: event.target.value })}
        aria-label="Event type description"
        placeholder="Add an event type description"
      />
      <button className={styles.deleteButton} type="button" onClick={onDelete} aria-label={`Delete ${option.name || "event type"}`}>
        <Trash2 size={18} />
      </button>
    </div>
  );
}

export function CustomFieldsManager({ kicker }: { kicker?: ReactNode }) {
  const [savedTypes, updateTypes] = useEventTypes();
  const [draft, setDraft] = useState<EventTypeDefinition[]>(() => loadEventTypes());
  const [selectedCategory, setSelectedCategory] = useState("Event Type");
  const [pendingDelete, setPendingDelete] = useState<EventTypeDefinition | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(savedTypes);
  const names = draft.map((item) => item.name.trim().toLowerCase());
  const hasBlank = draft.some((item) => !item.name.trim() || !item.description.trim());
  const hasDuplicate = new Set(names).size !== names.length;
  const canSave = dirty && !hasBlank && !hasDuplicate && draft.length > 0;

  const updateOption = (id: string, patch: Partial<EventTypeDefinition>) => {
    setDraft((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const addOption = () => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `event-type-${Date.now()}`;
    setDraft((current) => [...current, { id, name: "New event type", description: "" }]);
  };

  const moveOption = (sourceId: string, targetId: string) => {
    setDraft((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const save = () => {
    if (!canSave) return;
    const next = draft.map((item) => ({ ...item, name: item.name.trim(), description: item.description.trim() }));
    updateTypes(next);
    setDraft(next);
    showToast("Event types saved");
  };

  const discard = () => {
    setDraft(savedTypes.map((item) => ({ ...item })));
    showToast("Changes discarded");
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    setDraft((current) => current.filter((item) => item.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  return (
    <main className={styles.page}>
      <div className={styles.titleRow}>
        <h1>{kicker ?? "Custom Fields Manager"}</h1>
        <div>
          <button className={styles.discardButton} type="button" disabled={!dirty} onClick={discard}>Discard</button>
          <button className={styles.saveButton} type="button" disabled={!canSave} onClick={save}>Save</button>
        </div>
      </div>
      <div className={styles.manager}>
        <nav className={styles.categories} aria-label="Custom field categories">
          {categories.map((category) => (
            <button key={category} type="button" className={selectedCategory === category ? styles.categoryActive : ""} onClick={() => setSelectedCategory(category)}>
              {category}
            </button>
          ))}
        </nav>
        <section className={styles.content}>
          {selectedCategory === "Event Type" ? (
            <>
              <header className={styles.contentHeader}>
                <div>
                  <h2><CalendarDays size={20} /> Event Type</h2>
                  <p>Customize the event types shown in the event drawer. A short description helps Wiggli Smart Event create an invitation that fits the purpose of the meeting.</p>
                </div>
              </header>
              <div className={styles.optionsPanel}>
                <div className={styles.optionsToolbar}>
                  <div><strong>Event type options</strong><span>{draft.length} options</span></div>
                  <button type="button" onClick={addOption}><Plus size={18} /> New</button>
                </div>
                {(hasBlank || hasDuplicate) && <p className={styles.validation}>{hasBlank ? "Every event type needs a name and context." : "Event type names must be unique."}</p>}
                <div className={styles.optionsList}>
                  {draft.map((option) => (
                    <SortableOption
                      key={option.id}
                      option={option}
                      dragging={draggingId === option.id}
                      onChange={(patch) => updateOption(option.id, patch)}
                      onDelete={() => setPendingDelete(option)}
                      onDragStart={() => setDraggingId(option.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => { if (draggingId) moveOption(draggingId, option.id); setDraggingId(null); }}
                    />
                  ))}
                </div>
                <p className={styles.aiNote}>Add a short event type description so Wiggli Smart Event can create a more relevant invitation for your attendees.</p>
              </div>
            </>
          ) : (
            <div className={styles.emptyCategory}><div><h2>{selectedCategory}</h2><p>This custom field category is not configured in the calendar demo.</p></div></div>
          )}
        </section>
      </div>
      {pendingDelete && <DeleteDialog option={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />}
    </main>
  );
}
