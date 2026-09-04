"use client";

import {
  Activity,
  ArrowUpDown,
  Ban,
  CalendarDays,
  Check,
  CircleUserRound,
  CircleX,
  FileImage,
  FileText,
  Folder,
  Gauge,
  GripVertical,
  Info,
  Kanban,
  ListFilter,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  Volume2,
  Copy,
  Pencil,
  Plus,
  CalendarPlus,
} from "lucide-react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/chrome";
import { EventDrawer, type DrawerCandidate, type LinkedContext } from "@/components/event-drawer";
import { MeetingsTable } from "@/components/meetings-table";
import { usePortalMenu, PortalMenuList, type PortalMenuItem } from "@/components/ui/portal-menu";
import { DetailTabs } from "@/components/ui/detail-tabs";
import { getNextQuarterSlot } from "@/lib/datetime-proto";
import { useHighlight } from "@/lib/highlight";
import { showToast } from "@/components/toaster";
import type { EventDto } from "@/types/event";
import { findJob, jobMeetings, pipelineStages, type PipelineCandidate, type PipelineStage } from "../data";

const jobTabs = [
  { label: "Pipeline", icon: Kanban },
  { label: "Job details", icon: FileText },
  { label: "AI Matching", icon: Sparkles },
  { label: "AI assessments", icon: Sparkles },
  { label: "Scorecards", icon: ThumbsUp },
  { label: "Meetings", icon: CalendarDays, isNew: true },
  { label: "Notes", icon: MessageSquare },
  { label: "Performance", icon: Gauge },
  { label: "Files", icon: Folder },
  { label: "Withdrawn/Rejected", icon: Ban },
  { label: "Activities", icon: Activity },
  { label: "Submitted Candidates", icon: Send },
];

const stageCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableRects, pointerCoordinates } = args;
  if (pointerCoordinates) {
    const containing = [...droppableRects.entries()].filter(([id, rect]) => id !== active.id && rect.left <= pointerCoordinates.x && pointerCoordinates.x <= rect.left + rect.width && rect.top <= pointerCoordinates.y && pointerCoordinates.y <= rect.top + rect.height);
    if (containing.length > 0) {
      const smallest = containing.reduce((a, b) => (a[1].width * a[1].height <= b[1].width * b[1].height ? a : b));
      return [{ id: smallest[0] }];
    }
  }
  return closestCorners(args).filter((collision) => collision.id !== active.id);
};

function MatchRing({ value }: { value: number }) {
  const spokes = 16;
  const filled = Math.round((value / 100) * spokes);
  return (
    <span className="match-badge">
      <span className="match-pill">
        <svg className="match-loader" viewBox="0 0 24 24" aria-hidden="true">
          {Array.from({ length: spokes }, (_, index) => (
            <line
              key={index}
              x1="12" y1="3.5" x2="12" y2="7.5"
              stroke={index < filled ? "#2e9e6b" : "#d8e4df"}
              strokeWidth="2.1"
              strokeLinecap="round"
              transform={`rotate(${(index * 360) / spokes} 12 12)`}
            />
          ))}
        </svg>
        <b>{value}%</b>
      </span>
      <span className="match-tooltip" role="tooltip">Matching score</span>
    </span>
  );
}

function CandidateCard({ candidate, onScheduleInterview, highlighted }: { candidate: PipelineCandidate; onScheduleInterview: (candidate: PipelineCandidate) => void; highlighted?: boolean }) {
  const { has } = useHighlight();
  const shouldHighlight = highlighted && has("schedule");
  const [selected, setSelected] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <article
      className={`candidate-card ${selected ? "selected" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {selected && <span className="candidate-card-check"><Check size={11} /></span>}
      <header>
        <span className="candidate-avatar" style={{ background: candidate.color }}>{candidate.initials}</span>
        <div>
          <h4>{candidate.name}</h4>
          {candidate.role && <p>{candidate.role}</p>}
        </div>
        <button aria-label={`Actions for ${candidate.name}`}><MoreHorizontal size={16} /></button>
      </header>
      <footer>
        <span className="candidate-meta"><CircleUserRound size={14} /> {candidate.date}</span>
        <span className="candidate-meta"><MessageSquare size={14} /> N/A</span>
        <MatchRing value={candidate.match} />
      </footer>
      <AnimatePresence initial={false}>
        {(hovered || selected || shouldHighlight) && (
          <motion.div
            className="candidate-card-actions-wrap"
            initial={{ height: 0, opacity: 0, filter: "blur(6px)" }}
            animate={{ height: "auto", opacity: 1, filter: "blur(0px)" }}
            exit={{ height: 0, opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="candidate-card-actions-pad">
              <div className="candidate-card-actions">
                <label className={`candidate-select ${selected ? "on" : ""}`}>
                  <input type="checkbox" checked={selected} onChange={() => setSelected((current) => !current)} aria-label={`Select ${candidate.name}`} />
                  {selected && <Check size={11} />}
                </label>
                <div className="candidate-card-actions-right">
                  <button aria-label="AI matching"><Sparkles size={16} /></button>
                  <button aria-label="Files"><FileImage size={16} /></button>
                  <button aria-label="Message"><MessageCircle size={16} /></button>
                  <button aria-label="Scorecard"><ThumbsUp size={16} /></button>
                  <button aria-label={`Schedule a meeting with ${candidate.name}`} onClick={() => onScheduleInterview(candidate)} className={shouldHighlight ? "highlight-pulse" : ""}><CalendarDays size={16} /></button>
                  <button className="danger" aria-label="Disqualify"><CircleX size={16} /></button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function EmptyApplications() {
  return (
    <div className="pipeline-empty">
      <img src="/Frame.svg" alt="No applications" width={136} height={104} style={{ objectFit: "contain" }} />
      <p>New applications will be dropped here</p>
    </div>
  );
}

function SortableCandidateCard({ candidate, onScheduleInterview, highlighted }: { candidate: PipelineCandidate; onScheduleInterview: (candidate: PipelineCandidate) => void; highlighted?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: candidate.id });
  return (
    <div
      ref={setNodeRef}
      suppressHydrationWarning
      className={`candidate-card-sortable ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <CandidateCard candidate={candidate} onScheduleInterview={onScheduleInterview} highlighted={highlighted} />
    </div>
  );
}

function StageColumn({ stage, onScheduleInterview, highlightFirst }: { stage: PipelineStage; onScheduleInterview: (candidate: PipelineCandidate) => void; highlightFirst?: boolean }) {
  const { has } = useHighlight();
  const stageHighlight = has("schedule") && stage.id === "interview";
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const isEmpty = stage.id === "applications" && stage.candidates.length === 0;
  return (
    <section className={`pipeline-column ${stageHighlight ? "highlight-pulse" : ""}`}>
      <header className="pipeline-column-head">
        <input type="checkbox" aria-label={`Select all in ${stage.label}`} />
        <h3>{stage.label}</h3>
        <span className="pipeline-count">{stage.candidates.length}</span>
        <button aria-label={`Sort ${stage.label}`}><ArrowUpDown size={13} /></button>
        <button aria-label={`${stage.label} options`}><MoreHorizontal size={15} /></button>
      </header>
      <SortableContext items={stage.candidates.map((candidate) => candidate.id)} strategy={verticalListSortingStrategy}>
        <div className={`pipeline-column-body ${isEmpty ? "is-empty" : ""} ${isOver ? "drop-target" : ""} ${stageHighlight ? "highlight-pulse" : ""}`} ref={setNodeRef}>
          {stage.id === "applications" && stage.candidates.length === 0 && <EmptyApplications />}
          {stage.candidates.map((candidate, idx) => (
            <SortableCandidateCard candidate={candidate} onScheduleInterview={onScheduleInterview} highlighted={highlightFirst && idx === 0} key={candidate.id} />
          ))}
          {stage.id !== "applications" && (
            <button className="pipeline-add-candidate"><GripVertical size={15} /> Add candidate</button>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

/** Map a real DB event (created via the drawer) into the MeetingsTable row shape. */
function eventToMeetingRow(event: EventDto, index: number, jobTitle: string) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const date = `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, ${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")} - ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  const linked = event.previewData?.linkedTo ?? [];
  const candidate = linked.find((l) => l.type === "Candidate");
  const meetLink = event.hangoutLink ?? event.previewData?.meetingLinks?.[0]?.url ?? "";
  return {
    ref: `EV-${String(index + 1).padStart(4, "0")}`,
    title: event.summary,
    date,
    status: (event.status === "CANCELLED" ? "Canceled" : "Scheduled") as "Scheduled" | "Canceled",
    eventType: event.eventType ?? "Meeting",
    organizerName: event.previewData?.organizerName ?? "You",
    linkedCandidate: candidate ? { id: "", name: candidate.label, avatar: candidate.avatar ?? "" } : undefined,
    linkedJob: { id: "", title: jobTitle },
    attendees: event.attendees.map((a) => ({ name: a.name ?? a.email })),
    locationType: meetLink ? "Online" : "Company address",
    meetingPlace: meetLink || (event.location ?? ""),
    meetingLink: meetLink,
    provider: meetLink ? "google" : "company",
  };
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const reference = Number(params.id);
  const job = findJob(reference);
  const jobContext: LinkedContext = {
    id: `job-${job.reference}`,
    kind: "job",
    title: job.title,
    contract: job.type as "Permanent" | "Temporary",
    organizationId: "jacquet-scrl",
    organization: job.site,
    organizationInitials: "JS",
  };
  const [interviewCandidate, setInterviewCandidate] = useState<(DrawerCandidate & { id: string }) | null>(null);
  const [slot, setSlot] = useState(getNextQuarterSlot());
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingSlot, setMeetingSlot] = useState(getNextQuarterSlot());
  const menu = usePortalMenu();
  const [dbMeetings, setDbMeetings] = useState<ReturnType<typeof eventToMeetingRow>[]>([]);

  const loadMeetings = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) return;
      const data = await res.json();
      const events: EventDto[] = Array.isArray(data) ? data : data.events ?? [];
      const linked = events.filter((e) =>
        (e.previewData?.linkedTo ?? []).some((l) => l.type === "Job" && l.label === job.title)
      );
      setDbMeetings(linked.map((e, i) => eventToMeetingRow(e, i, job.title)));
    } catch {
      /* meetings list stays seeded-only */
    }
  }, [job.title]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const [stages, setStages] = useState<PipelineStage[]>(() => pipelineStages.map((stage) => ({ ...stage, candidates: [...stage.candidates] })));
  const [activeCandidate, setActiveCandidate] = useState<PipelineCandidate | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const initialTab = searchParams.get("tab") === "meetings" ? "Meetings" : "Pipeline";
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    const desiredTab = activeTab === "Meetings" ? "meetings" : null;
    if (currentTab === desiredTab) return;
    const next = new URLSearchParams(searchParams.toString());
    if (desiredTab) next.set("tab", desiredTab);
    else next.delete("tab");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [activeTab, pathname, router, searchParams]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const jobInterviews = jobMeetings.filter((interview) => interview.jobTitle.toLowerCase() === job.title.toLowerCase());

  const [drawerEventType, setDrawerEventType] = useState<"Interview" | "Meeting">("Meeting");
  const scheduleInterview = (candidate: PipelineCandidate, type: "Interview" | "Meeting" = "Meeting") => {
    setSlot(getNextQuarterSlot());
    setDrawerEventType(type);
    setInterviewCandidate({ id: candidate.id, name: candidate.name, jobTitle: job.title });
  };

  const interviewLinkedRecords = interviewCandidate
    ? ([
        { type: "Candidate" as const, item: { id: interviewCandidate.id, name: interviewCandidate.name, email: "", avatar: "" } },
        { type: "Job" as const, item: { id: String(job.reference), title: job.title, name: job.title } },
      ] as const)
    : undefined;

  const handleCreate = () => {
    setInterviewCandidate(null);
    setMeetingOpen(false);
    showToast("Interview proposed — synced to calendar");
    void loadMeetings();
    window.setTimeout(() => void loadMeetings(), 1800);
  };
  const handleMeetingSchedule = () => { setMeetingSlot(getNextQuarterSlot()); setMeetingOpen(true); };

  const findStageId = (id: string): string | undefined => {
    if (stages.some((stage) => stage.id === id)) return id;
    return stages.find((stage) => stage.candidates.some((candidate) => candidate.id === id))?.id;
  };

  const onDragStart = (event: DragStartEvent) => {
    const candidate = stages.flatMap((stage) => stage.candidates).find((item) => item.id === event.active.id);
    setActiveCandidate(candidate ?? null);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeStageId = findStageId(String(active.id));
    const overStageId = findStageId(String(over.id));
    if (!activeStageId || !overStageId || activeStageId === overStageId) return;
    setStages((current) => {
      const candidate = current.find((stage) => stage.id === activeStageId)?.candidates.find((item) => item.id === active.id);
      if (!candidate) return current;
      return current.map((stage) => {
        if (stage.id === activeStageId) {
          return { ...stage, candidates: stage.candidates.filter((item) => item.id !== active.id) };
        }
        if (stage.id === overStageId) {
          const overIndex = stage.candidates.findIndex((item) => item.id === over.id);
          const next = [...stage.candidates];
          next.splice(overIndex === -1 ? next.length : overIndex, 0, candidate);
          return { ...stage, candidates: next };
        }
        return stage;
      });
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const droppedCandidate = activeCandidate;
    setActiveCandidate(null);
    if (!over) return;
    const activeStageId = findStageId(String(active.id));
    const overStageId = findStageId(String(over.id));
    if (activeStageId && overStageId && activeStageId === overStageId) {
      setStages((current) => current.map((stage) => {
        if (stage.id !== activeStageId) return stage;
        const oldIndex = stage.candidates.findIndex((item) => item.id === active.id);
        const newIndex = stage.candidates.findIndex((item) => item.id === over.id);
        return oldIndex !== -1 && newIndex !== -1 ? { ...stage, candidates: arrayMove(stage.candidates, oldIndex, newIndex) } : stage;
      }));
    }
    if (activeStageId === "interview" && droppedCandidate) {
      scheduleInterview(droppedCandidate, "Interview");
    }
  };

  return (
    <>
      <Header kicker={<><span className="kicker-muted">Permanent / Job / </span>{job.title}</>} />
      <main className="job-detail-page" style={activeTab === "Meetings" ? { overflowY: "auto", overflowX: "hidden" } : undefined}>
        <div className="job-detail-head">
          <div className="job-detail-title">
            <h1>{job.title}</h1>
            <span className="job-pill permanent">{job.type}</span>
            <Info size={15} />
            <span className="job-pill published"><i /> Published</span>
            <span className="job-pill-on">On <b>+2</b></span>
            <Volume2 size={18} />
          </div>
          <button ref={menu.triggerRef} className="job-detail-more" aria-label="More actions" aria-expanded={menu.open} onClick={() => { menu.alignMenu(224, "right"); menu.setOpen((v) => !v); }} type="button"><MoreHorizontal size={18} /></button>
          <PortalMenuList
            open={menu.open}
            pos={menu.pos}
            menuRef={menu.menuRef}
            onClose={() => menu.setOpen(false)}
            items={[
              { label: "Schedule a meeting", icon: CalendarPlus, action: handleMeetingSchedule },
              { label: "Close to applications", icon: Ban, group: "Job options" },
              { label: "Edit", icon: Pencil },
              { label: "Duplicate", icon: Copy },
              { label: "Mark as filled", icon: Check },
              { label: "Add candidate", icon: Plus, group: "Pipeline options" },
              { label: "Add new step", icon: Plus },
              { label: "Add task", icon: Plus },
            ] as PortalMenuItem[]}
          />
        </div>
        <p className="job-detail-meta">#{job.reference} • Created and Posted 15/06/2026 by Axelle Bastin</p>

        <DetailTabs
          tabs={jobTabs}
          active={activeTab}
          onChange={setActiveTab}
          variant="job"
          clickable={(label) => label === "Pipeline" || label === "Meetings"}
        />

        {activeTab === "Meetings" ? (
          <MeetingsTable
            filterEntity="job"
            filterId={String(params.id ?? job.reference)}
            filterName={job.title}
            onScheduleMeeting={handleMeetingSchedule}
            extraMeetings={[...dbMeetings, ...jobInterviews.map((m) => ({
              title: `${m.type} with ${m.candidateName}`,
              date: `${m.interviewDate}, ${m.startTime} - ${m.endTime}`,
              start: m.startTime,
              end: m.endTime,
              eventType: m.type,
              linkedCandidate: { id: m.candidateName.toLowerCase().replace(/\s+/g, "-"), name: m.candidateName, avatar: "" },
              linkedJob: { id: String(job.reference), title: job.title },
              linkedOrganization: m.organization && m.organization !== "—" ? { id: m.organization.toLowerCase().replace(/\s+/g, "-"), name: m.organization, initials: m.organization.slice(0, 2).toUpperCase(), color: "#0f766e" } : undefined,
              attendees: m.attendees,
              locationType: m.locationType,
              meetingPlace: m.location,
              meetingLink: m.meetingLink,
              provider: m.locationType === "Online" ? "wiggli" : "company",
            }))]}
          />
        ) : <>
          <div className="pipeline-toolbar">
            <label className="pipeline-search">
              <Search size={15} />
              <input type="text" placeholder="Quick Search..." />
            </label>
            <button className="pipeline-filter-button" type="button"><ListFilter size={15} /> Filter</button>
            <button className="pipeline-ai-criteria" type="button"><SlidersHorizontal size={15} /> AI Criteria</button>
          </div>

          <div className="pipeline-board">
            <DndContext
              sensors={sensors}
              collisionDetection={stageCollisionDetection}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={() => setActiveCandidate(null)}
            >
              {(() => {
                const firstWithCandidates = stages.find((s) => s.candidates.length > 0)?.id;
                return stages.map((stage) => (
                  <StageColumn stage={stage} onScheduleInterview={scheduleInterview} key={stage.id} highlightFirst={stage.id === firstWithCandidates} />
                ));
              })()}
              <DragOverlay dropAnimation={{ duration: 0 }}>
                {activeCandidate ? (
                  <div className="candidate-card-drag-overlay">
                    <CandidateCard candidate={activeCandidate} onScheduleInterview={() => undefined} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </>}
      </main>
      <EventDrawer
        open={interviewCandidate !== null}
        onClose={() => setInterviewCandidate(null)}
        slot={slot}
        onCreate={handleCreate}
        initialLinkedRecords={interviewLinkedRecords as never}
        fixedEventType={drawerEventType}
        fixedContext={jobContext}
      />
      <EventDrawer
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        slot={meetingSlot}
        onCreate={handleCreate}
        initialLinkedRecords={[{ type: "Job" as const, item: { id: String(job.reference), title: job.title } }] as never}
        fixedEventType="Meeting"
      />
    </>
  );
}
