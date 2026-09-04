import { Link2 } from "lucide-react";
import { Video, MapPin, Building2 } from "lucide-react";

/** Icon + label cell for a location type (Online / Another location / Company address). */
export function LocationTypeCell({ type }: { type: string }) {
  if (!type || type === "—") return <span style={{ color: "#cbd5e1" }}>—</span>;
  const icon =
    type === "Online" ? <Video size={14} style={{ color: "#475569" }} />
    : type === "Another location" ? <MapPin size={14} style={{ color: "#475569" }} />
    : <Building2 size={14} style={{ color: "#475569" }} />;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>{icon} {type}</span>;
}

/** Provider logo tile (Google Meet / Wiggli / Teams / Zoom) or link icon for manual URLs. */
export function MeetingPlaceIcon({ provider }: { provider?: string }) {
  const logos: Record<string, string> = {
    wiggli: "/wiggli-meet.png",
    google: "/google-meet.png",
    teams: "/microsoft-teams.png",
    zoom: "/Zoom-logo.png",
  };
  if (provider && logos[provider]) {
    return <span style={{ width: 32, height: 32, borderRadius: 6, background: "#fff", display: "grid", placeItems: "center", flex: "none", overflow: "hidden" }}><img src={logos[provider]} alt={provider} style={{ width: 22, height: 22, objectFit: "contain" }} /></span>;
  }
  if (provider === "custom" || provider === "manual") {
    return <span style={{ width: 32, height: 32, borderRadius: 6, background: "#f1f5f9", display: "grid", placeItems: "center", color: "#64748b", flex: "none" }}><Link2 size={14} /></span>;
  }
  return null;
}
