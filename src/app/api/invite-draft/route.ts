import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateInviteDraft, type InviteTab, type TemplateContext } from "@/lib/gemini";

/**
 * AI invitation drafting for the EventDrawer step 2.
 * POST { context: TemplateContext, tabs: InviteTab[], instruction?: string }
 * → { drafts: Record<InviteTab, string> }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: { context?: Partial<TemplateContext>; tabs?: InviteTab[]; instruction?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ctx = body.context;
  if (!ctx?.title || !ctx?.eventType || !ctx?.when) {
    return NextResponse.json(
      { error: "context.eventType, context.title and context.when are required." },
      { status: 400 }
    );
  }

  const validTabs = (body.tabs ?? ["candidate"]).filter((t): t is InviteTab =>
    ["candidate", "contact", "internal"].includes(t)
  );
  if (validTabs.length === 0) {
    return NextResponse.json({ error: "At least one tab is required." }, { status: 400 });
  }

  const fullCtx: TemplateContext = {
    eventType: ctx.eventType,
    eventTypeDescription:
      typeof ctx.eventTypeDescription === "string" ? ctx.eventTypeDescription : undefined,
    title: ctx.title,
    description: ctx.description,
    when: ctx.when,
    hasMeetLink: Boolean(ctx.hasMeetLink),
    locationLabel: ctx.locationLabel ?? null,
    reminderLabel:
      typeof ctx.reminderLabel === "string" ? ctx.reminderLabel : null,
    linkedRecords: Array.isArray(ctx.linkedRecords)
      ? ctx.linkedRecords
          .filter((r) => r && typeof r.type === "string" && typeof r.title === "string")
          .map((r) => ({ type: r.type, title: r.title }))
      : undefined,
    organizationName: ctx.organizationName ?? null,
    attendeeGroups: ctx.attendeeGroups ?? undefined,
    organizerName:
      session.user.name ?? session.user.email.split("@")[0],
  };

  try {
    const { drafts, subjects } = await generateInviteDraft(fullCtx, validTabs, body.instruction);
    return NextResponse.json({ drafts, subjects });
  } catch (err) {
    console.error("[invite-draft]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI generation failed" },
      { status: 500 }
    );
  }
}
