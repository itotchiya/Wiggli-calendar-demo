"use client";

import { CalendarCheck2, Mail, Send, Sparkles, WandSparkles, X } from "lucide-react";
import { useEffect } from "react";
import Image from "next/image";

export type CreatorMode = "smart" | "resend-rsvp" | "native";

// Keep the Resend comparison flow implemented, but hide it for the demo.
const SHOW_RESEND_RSVP_OPTION = false;

export function CreatorDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: CreatorMode) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="creator-scrim" onClick={onClose} role="presentation">
      <div className="creator-dialog" role="dialog" aria-modal="true" aria-labelledby="creator-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="creator-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <div className="creator-heading">
          <span className="creator-kicker">Choose your invitation experience</span>
          <h2 id="creator-title">How do you want to schedule?</h2>
          <p>All options create a real Google Calendar event. Choose the invitation delivery you want to compare.</p>
        </div>
        <div className={`creator-options ${SHOW_RESEND_RSVP_OPTION ? "" : "creator-options-demo"}`}>
          <button type="button" className="creator-card creator-card-smart" onClick={() => onSelect("smart")}>
            <span className="creator-recommended">Recommended</span>
            <span className="creator-card-icon"><WandSparkles size={25} /></span>
            <span className="creator-card-title">Wiggli Smart Event</span>
            <span className="creator-card-copy">AI writes a tailored invitation for candidates, contacts and internal attendees.</span>
            <span className="creator-features">
              <span><Sparkles size={14} /> Context-aware AI copy</span>
              <span><Mail size={14} /> Styled email from your Gmail</span>
              <span><CalendarCheck2 size={14} /> Calendar invite with RSVP support</span>
            </span>
            <span className="creator-cta">Create smart event</span>
          </button>
          {SHOW_RESEND_RSVP_OPTION && (
            <button type="button" className="creator-card creator-card-resend" onClick={() => onSelect("resend-rsvp")}>
              <span className="creator-test-badge">Testing alternative</span>
              <span className="creator-card-icon creator-resend-icon"><Send size={25} /></span>
              <span className="creator-card-title">Resend RSVP Event</span>
              <span className="creator-card-copy">Send the same tailored invitation from a professional calendar domain using Workable-style RSVP delivery.</span>
              <span className="creator-features">
                <span><Sparkles size={14} /> Same AI invitation editor</span>
                <span><Mail size={14} /> Professional Resend sender</span>
                <span><CalendarCheck2 size={14} /> One native RSVP invite per slot</span>
              </span>
              <span className="creator-cta creator-cta-resend">Create Resend RSVP event</span>
            </button>
          )}
          <button type="button" className="creator-card creator-card-native" onClick={() => onSelect("native")}>
            <span className="creator-card-icon creator-google-icon"><Image src="/google-calendar.png" alt="" width={29} height={29} /></span>
            <span className="creator-card-title">Native Google Event</span>
            <span className="creator-card-copy">Google sends its standard calendar invitation directly to every attendee.</span>
            <span className="creator-features">
              <span><CalendarCheck2 size={14} /> Google Calendar invitation</span>
              <span><Mail size={14} /> Standard Google email</span>
              <span><Sparkles size={14} /> Built-in RSVP synchronization</span>
            </span>
            <span className="creator-cta creator-cta-native">Create native event</span>
          </button>
        </div>
      </div>
    </div>
  );
}
