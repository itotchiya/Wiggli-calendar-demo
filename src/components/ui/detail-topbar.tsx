"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

/** Detail-page topbar: Back button + prev/next record arrows. */
export function DetailTopbar({ onBack, prevDisabled = true, nextDisabled = true }: { onBack?: () => void; prevDisabled?: boolean; nextDisabled?: boolean }) {
  const router = useRouter();
  return (
    <div className="contact-detail-topbar">
      <button className="contact-back-button" onClick={onBack ?? (() => router.back())} type="button">
        <ChevronLeft size={16} /> Back
      </button>
      <div className="contact-detail-nav">
        <button className="contact-nav-arrow" disabled={prevDisabled} type="button">
          <ChevronLeft size={16} />
        </button>
        <button className="contact-nav-arrow" disabled={nextDisabled} type="button">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
