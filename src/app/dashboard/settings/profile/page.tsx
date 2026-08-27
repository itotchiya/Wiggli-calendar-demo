"use client";

import { Check, ChevronDown, Copy, Link2, Pencil, Unlink, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type ComponentType } from "react";
import { Header } from "@/components/chrome";
import { showToast } from "@/components/toaster";
import { useIntegrations, type Suite } from "@/lib/integrations";

const LOGIN_URLS: Record<Suite | "zoom", string> = {
  google: "https://accounts.google.com/signin",
  outlook: "https://login.microsoftonline.com/",
  zoom: "https://zoom.us/signin",
};

function GmailLogo() {
  return <img className="suite-logo" src="/gmail.png" alt="" aria-hidden="true" />;
}

function GoogleCalendarLogo() {
  return <img className="suite-logo" src="/google-calendar.png" alt="" aria-hidden="true" />;
}

function OutlookLogo() {
  return <img className="suite-logo" src="/microsoft-outlook.png" alt="" aria-hidden="true" />;
}

function OutlookCalendarLogo() {
  return <img className="suite-logo" src="/microsoft-calendar.png" alt="" aria-hidden="true" />;
}

type SuiteOption = { id: Suite; label: string; Logo: ComponentType };

const emailOptions: SuiteOption[] = [
  { id: "google", label: "Google (Gmail)", Logo: GmailLogo },
  { id: "outlook", label: "Outlook (Email)", Logo: OutlookLogo },
];
const calendarOptions: SuiteOption[] = [
  { id: "google", label: "Google Calendar", Logo: GoogleCalendarLogo },
  { id: "outlook", label: "Outlook Calendar", Logo: OutlookCalendarLogo },
];

function SuiteSelect({ value, options, onChange }: { value: Suite; options: SuiteOption[]; onChange: (id: Suite) => void }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value) ?? options[0];
  return (
    <div className="suite-select-wrap">
      <button type="button" className="suite-select" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <selected.Logo />
        <span className="suite-select-label">{selected.label}</span>
        <ChevronDown size={15} className="suite-chevron" />
      </button>
      {open && (
        <>
          <button type="button" className="menu-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="suite-menu">
            {options.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                <option.Logo />
                <span>{option.label}</span>
                {option.id === value && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const profileFields = [
  { label: "First name", value: "Demetrius" },
  { label: "Last name", value: "Clayton" },
  { label: "Mobile number", value: "+212650445451" },
  { label: "Email", value: "j.doe@gmail.com" },
  { label: "Job title", value: "Ceo Company" },
  { label: "Role", value: "Super Admin – all" },
];

const emailNotes = [
  "This will be your default email address. You can send and receive emails using your wiggli address.",
  "If you synced your email address you'll receive emails in your own email address not the wiggli address.",
  "If you stopped the sync then you'll no longer receive emails that comes from your non-wiggli address.",
  "You can't change your wiggli email address. For more details contact our support.",
];

export default function MyProfilePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState("/avatars/avatar-20.webp");
  const [integrations, updateIntegrations] = useIntegrations();
  const { suite, emailSynced, calendarSynced, zoomConnected } = integrations;

  const meetEnabled = suite === "google" && calendarSynced.google;
  const teamsEnabled = suite === "outlook" && calendarSynced.outlook;

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, []);

  const setSuite = (id: Suite) => updateIntegrations((current) => ({ ...current, suite: id }));

  const openLogin = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const connectEmail = () => {
    openLogin(LOGIN_URLS[suite]);
    updateIntegrations((current) => ({ ...current, emailSynced: { ...current.emailSynced, [suite]: true } }));
  };
  const connectCalendar = () => {
    openLogin(LOGIN_URLS[suite]);
    updateIntegrations((current) => ({ ...current, calendarSynced: { ...current.calendarSynced, [suite]: true } }));
  };
  const connectZoom = () => {
    openLogin(LOGIN_URLS.zoom);
    updateIntegrations((current) => ({ ...current, zoomConnected: true }));
  };

  const onPickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image exceeds the 5mb limit");
      return;
    }
    setPhoto(URL.createObjectURL(file));
  };

  const copyWiggliEmail = () => {
    navigator.clipboard?.writeText("jefferey.c@wigglimail.com").then(() => showToast("Wiggli email address copied"));
  };

  return (
    <>
      <Header kicker={<><span className="kicker-muted">Settings / </span>My Profile</>} />
      <main className="profile-page">
        <h1>My Profile</h1>

        <section className="profile-section">
          <div className="profile-section-aside">
            <h2>Edit profile picture</h2>
            <p>Upload a profile picture of yourself</p>
          </div>
          <div className="profile-section-body photo-row">
            <div className="photo-block">
              <img className="profile-photo" src={photo} alt="Demetrius Clayton" />
              <div>
                <h3>Upload new image</h3>
                <p>Max file size- 5mb</p>
              </div>
            </div>
            <button type="button" className="profile-outline-btn" onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Upload image
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-section-aside">
            <h2>Personal information</h2>
            <p>Informations you add, will be visible all over the platform.</p>
          </div>
          <div className="profile-section-body">
            <div className="section-action-row">
              <button type="button" className="profile-outline-btn"><Pencil size={14} /> Edit profile</button>
            </div>
            <div className="info-grid">
              {profileFields.map((field) => (
                <div key={field.label}>
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="profile-section" id="wiggli-mail">
          <div className="profile-section-aside">
            <h2>My Wiggli Email and calendar</h2>
            <button type="button" className="wiggli-mail-chip" onClick={copyWiggliEmail}>
              jefferey.c@wigglimail.com <Copy size={12} />
            </button>
            <p>Communicate faster using wiggli Mail.</p>
          </div>
          <div className="profile-section-body">
            <p className="section-desc">Sync your personal or company email & calendar and stay up to date with events in Wiggli</p>
            <div className="sync-card">
              <div className="sync-row">
                <SuiteSelect value={suite} options={emailOptions} onChange={setSuite} />
                <div className="sync-state">
                  {emailSynced[suite] ? (
                    <>
                      <span className="sync-status ok">Synced</span>
                      <button type="button" className="connect-btn disconnect" onClick={() => updateIntegrations((current) => ({ ...current, emailSynced: { ...current.emailSynced, [suite]: false } }))}>
                        <Unlink size={14} /> Disconnect
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="sync-status off">Not Synced</span>
                      <button type="button" className="connect-btn" onClick={connectEmail}>
                        <Link2 size={14} /> Connect
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="sync-row">
                <SuiteSelect value={suite} options={calendarOptions} onChange={setSuite} />
                <div className="sync-state">
                  {calendarSynced[suite] ? (
                    <>
                      <span className="sync-status ok">Synced</span>
                      <button type="button" className="connect-btn disconnect" onClick={() => updateIntegrations((current) => ({ ...current, calendarSynced: { ...current.calendarSynced, [suite]: false } }))}>
                        <Unlink size={14} /> Disconnect
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="sync-status off">Not Synced</span>
                      <button type="button" className="connect-btn" onClick={connectCalendar}>
                        <Link2 size={14} /> Connect
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="profile-notes">
              <h3>Notes</h3>
              <ul>
                {emailNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="profile-section" id="video-meetings">
          <div className="profile-section-aside">
            <h2>Video Meetings</h2>
            <p>Automatically add video meeting links to your events and interviews.</p>
          </div>
          <div className="profile-section-body">
            <div className="meeting-row">
              <img src="/google-meet.png" alt="Google Meet" className="meeting-provider-logo" />
              <span className="meeting-name">Google Meet</span>
              <div className="sync-state">
                {meetEnabled
                  ? <span className="sync-status ok">Enabled</span>
                  : <span className="sync-status required">Google Calendar required</span>}
              </div>
            </div>
            <div className="meeting-row">
              <img src="/microsoft-teams.png" alt="Microsoft Teams" className="meeting-provider-logo" />
              <span className="meeting-name">Microsoft Teams</span>
              <div className="sync-state">
                {teamsEnabled
                  ? <span className="sync-status ok">Enabled</span>
                  : <span className="sync-status required">Outlook Calendar required</span>}
              </div>
            </div>
            <div className="meeting-row">
              <img src="/Zoom-logo.png" alt="Zoom" className="meeting-provider-logo" />
              <span className="meeting-name">Zoom</span>
              <div className="sync-state">
                {zoomConnected ? (
                  <button type="button" className="connect-btn disconnect" onClick={() => updateIntegrations((current) => ({ ...current, zoomConnected: false }))}>
                    <Unlink size={14} /> Disconnect
                  </button>
                ) : (
                  <button type="button" className="connect-btn zoom-connect" onClick={connectZoom}>Connect</button>
                )}
              </div>
            </div>
            <div className="profile-notes">
              <h3>How it works</h3>
              <p>
                To use Google Meet or Microsoft Teams, connect and select the corresponding calendar in the section above.
                Google Meet works with Google Calendar, while Microsoft Teams works with Outlook Calendar.
                Zoom can be connected separately.
              </p>
            </div>
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-section-aside">
            <h2>User roles</h2>
            <p>Discover Your Assignments. Explore all your roles across different vacancies with ease</p>
          </div>
          <div className="profile-section-body roles-row">
            <span className="role-chip">Admin - UI/UX Design</span>
            <span className="role-chip">Admin - Internal Tech recruitment</span>
          </div>
        </section>
      </main>
    </>
  );
}
