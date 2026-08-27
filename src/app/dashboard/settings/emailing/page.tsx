"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  ExternalLink,
  MailCheck,
  MapPin,
  Play,
  Send,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/chrome";
import styles from "./emailing.module.css";

type Recipient = "client" | "freelancer" | "consultancy" | "permanent" | "temporary" | "super_admin" | "external";
type Format = "video" | "onsite";
type ScenarioKey = "invitation" | "confirmation" | "accepted" | "declined" | "refused" | "canceled" | "expired" | "archived" | "external" | "awaiting" | "done" | "admin48" | "expiredAdmin";

type Scenario = {
  key: ScenarioKey;
  short: string;
  label: string;
  description: string;
  timing: string;
  recipients: Recipient[];
  usesFormat?: boolean;
  variables: string[];
};

type Context = {
  recipient: Recipient;
  format: Format;
  hasCompany: boolean;
  hasConsultant: boolean;
  isBid: boolean;
  hasReason: boolean;
  isDirect: boolean;
  clientIntervieweePermanent: boolean;
  recipientName: string;
  participantName: string;
  senderName: string;
  companyName: string;
  jobTitle: string;
};

type EmailResult = {
  subject: string;
  eyebrow: string;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  cta?: string;
  route: string[];
  included: string[];
  omitted: string[];
  explanation: string;
};

const recipientLabels: Record<Recipient, string> = {
  client: "Client / recruiter",
  freelancer: "Freelancer",
  consultancy: "Consultancy",
  permanent: "Permanent candidate",
  temporary: "Temporary candidate",
  super_admin: "Super admin",
  external: "External guest",
};

const scenarios: Scenario[] = [
  { key: "invitation", short: "01", label: "Interview invitation", description: "A new interview date is proposed and needs a response.", timing: "Immediately after the interview proposal is created", recipients: ["freelancer", "permanent", "consultancy", "temporary"], usesFormat: true, variables: ["FIRST_NAME", "USER_SEND_FULL_NAME", "JOB_TITLE", "DATE", "START_TIME", "END_TIME", "SENDER_COMPANY", "VIDEO_CONFERENCE", "LINK"] },
  { key: "confirmation", short: "02", label: "Interview confirmation", description: "The selected slot is confirmed for every involved party.", timing: "Immediately when a proposed slot becomes confirmed", recipients: ["client", "freelancer", "consultancy", "permanent", "temporary"], usesFormat: true, variables: ["FIRST_NAME", "FULL_NAME", "MISSION_TITLE", "DATE", "TIME", "END_TIME", "VIDEO_CONFERENCE", "INTERVIEW_ADDRESS", "COMPANY_NAME", "OUTSIDE_LINK"] },
  { key: "accepted", short: "03", label: "Interview accepted", description: "Notifies the other party that a proposed slot was accepted.", timing: "Immediately after a recipient accepts the slot", recipients: ["client", "freelancer", "consultancy"], usesFormat: true, variables: ["FIRST_NAME_RECP", "FULL_NAME", "DATE", "TIME", "VIDEO_CONFERENCE", "CONSULTANT_FULL_NAME", "MISSION_TITLE", "ADDRESS"] },
  { key: "declined", short: "04", label: "Alternative proposed", description: "Legacy name: declined. In practice, another date or location was proposed.", timing: "Immediately after a recipient proposes an alternative", recipients: ["permanent", "freelancer", "consultancy", "client"], usesFormat: true, variables: ["FIRST_NAME", "ACCOUNT_TYPE", "REQUEST_TITLE", "USER_SEND_FULL_NAME", "DATE", "START_TIME", "END_TIME", "IS_BID", "LOCATION_TYPE", "INTERVIEW_ADDRESS"] },
  { key: "refused", short: "05", label: "Interview refused", description: "The request was explicitly rejected rather than rescheduled.", timing: "Immediately after an interview request is refused", recipients: ["freelancer", "consultancy"], variables: ["FIRST_NAME", "TYPE", "NAME_TYPE", "CONSULTANT_FULL_NAME", "JOB_TITLE", "DESCRIPTION", "COMPANY_NAME", "LINK"] },
  { key: "canceled", short: "06", label: "Interview canceled", description: "A planned interview was canceled, optionally with a reason.", timing: "Immediately after cancellation", recipients: ["permanent", "client", "freelancer", "consultancy", "temporary"], variables: ["FIRST_NAME", "ACCOUNT_TYPE", "CLIENT_COMPANY_NAME", "APPLICATION_TITLE", "CANCEL_REASON", "USER_SEND_FULL_NAME", "POKE_ID"] },
  { key: "expired", short: "07", label: "Interview expired", description: "The proposed date passed before a response was recorded.", timing: "When the proposed start time passes with a pending response", recipients: ["freelancer", "consultancy", "permanent", "client"], usesFormat: true, variables: ["FIRST_NAME", "RECIPIENT_TYPE", "VIDEO_CONFERENCE", "ACCOUNT_TYPE", "INTERVIEW_WITH", "MISSION_TITLE", "DATE", "TIME", "ADDRESS"] },
  { key: "archived", short: "08", label: "Interview archived", description: "A flexible administrative message about an archived interview.", timing: "When an administrator archives an interview", recipients: ["client", "freelancer", "consultancy", "permanent", "temporary"], variables: ["FIRST_NAME", "MESSAGE"] },
  { key: "external", short: "09", label: "External notification", description: "A static notification for someone without a Wiggli account.", timing: "When an external participant is added", recipients: ["external"], variables: ["MANAGER_NAME", "NAME_FREELANCER", "ADDRESS", "DATE_INTERVIEW"] },
  { key: "awaiting", short: "10", label: "Awaiting response reminder", description: "Warns that an unanswered proposal starts within 24 hours.", timing: "Scheduled job: pending response and start time is within 24 hours", recipients: ["freelancer", "client", "consultancy"], variables: ["FIRST_NAME", "MISSION_TITLE", "LINK_VIEW_BID"] },
  { key: "done", short: "11", label: "Post-interview reminder", description: "Prompts a hiring decision after the interview has happened.", timing: "Scheduled job: 24 hours after interview completion", recipients: ["freelancer", "consultancy"], variables: ["FIRST_NAME", "INTERVIEW_DATE", "VENDOR_FULL_NAME", "MISSION_TITLE", "VENDOR_FIRST_NAME"] },
  { key: "admin48", short: "12", label: "48h admin alert", description: "Alerts support when no client action follows a completed interview.", timing: "Scheduled job: 48 hours after completion with no decision", recipients: ["super_admin"], variables: ["CLIENT_COMPANY_NAME", "CLIENT_FULL_NAME", "ACCOUNT_TYPE", "VENDOR_FULL_NAME", "JOB_REF", "START_DATE", "COMMENT"] },
  { key: "expiredAdmin", short: "13", label: "Expired admin alert", description: "Alerts support that a proposal expired without a response.", timing: "Scheduled job: after an interview proposal expires", recipients: ["super_admin"], variables: ["CLIENT_COMPANY_NAME", "CLIENT_FULL_NAME", "ACCOUNT_TYPE", "VENDOR_FULL_NAME", "JOB_REF", "START_DATE", "NAME_INTERVIEWER"] },
];

const DATE = "Thursday, 20 August 2026";
const TIME = "10:30 to 11:15";
const ADDRESS = "Wiggli Brussels, Avenue Louise 231, Brussels, Belgium";
const ROOM = "https://meet.wiggli.com/interview/rd-chemistry";

function commonRoute(scenario: Scenario, context: Context) {
  const route = [`Event: ${scenario.label}`, `Recipient: ${recipientLabels[context.recipient]}`];
  if (scenario.usesFormat) route.push(`Format: ${context.format === "video" ? "Video conference" : "Onsite"}`);
  return route;
}

function locationDetails(format: Format) {
  return format === "video"
    ? [{ label: "Location", value: "Video interview (virtual meeting room)" }, { label: "Join URL", value: ROOM }]
    : [{ label: "Location", value: ADDRESS }];
}

function buildEmail(scenario: Scenario, context: Context): EmailResult {
  const { recipient, format, recipientName, participantName, senderName, companyName, jobTitle } = context;
  const hello = recipient === "external" ? "Hi," : `Dear ${recipientName},`;
  const route = commonRoute(scenario, context);
  const locationIncluded = format === "video" ? ["VIDEO_CONFERENCE"] : ["INTERVIEW_ADDRESS", "CITY", "COUNTRY"];
  const locationOmitted = format === "video" ? ["INTERVIEW_ADDRESS", "CITY", "COUNTRY"] : ["VIDEO_CONFERENCE", "OUTSIDE_LINK"];

  switch (scenario.key) {
    case "invitation": {
      if (recipient === "freelancer") return { subject: `Interview invitation for ${jobTitle}`, eyebrow: "Action required: review the proposed slot", paragraphs: [hello, `${senderName} has invited you to an interview regarding your application on the job “${jobTitle}”.`, `The proposed interview is to take place on ${DATE} from ${TIME}.`], cta: "View application", route: [...route, "Branch: freelancer application"], included: ["FIRST_NAME", "USER_SEND_FULL_NAME", "JOB_TITLE", "DATE", "START_TIME", "END_TIME", "LINK"], omitted: locationOmitted, explanation: "Freelancers are routed to their application. The legacy copy does not change by location for this recipient." };
      if (recipient === "consultancy") return { subject: `Interview request for ${participantName}`, eyebrow: "Action required: reply for your consultant", paragraphs: [hello, `${senderName} from ${companyName} has requested an interview with your consultant ${participantName} regarding the bid made on “${jobTitle}”.`, format === "video" ? `The video interview is proposed for ${DATE}, ${TIME}. A room link becomes available after confirmation.` : `The proposed interview is to take place on ${DATE} from ${TIME}.`], cta: "Go to application", route: [...route, "Branch: consultancy", format === "video" ? "VIDEO_CONFERENCE present" : "VIDEO_CONFERENCE absent"], included: ["FIRST_NAME", "CONSULTANT_FULL_NAME", "SENDER_COMPANY", "JOB_TITLE", "DATE", ...locationIncluded], omitted: locationOmitted, explanation: "Consultancies receive agency-oriented copy. The video branch intentionally withholds the final room link until confirmation." };
      return { subject: `Interview invitation for ${jobTitle}`, eyebrow: "Action required: review and reply", paragraphs: [hello, `I would like to organise an interview with you for the role of “${jobTitle}”.`, "Please review and reply to my invitation using the button below.", `Kind regards,\n${senderName}\n${companyName}`], cta: "View interview invitation", route: [...route, recipient === "temporary" ? "Service template: temporary_interview_email" : "Branch: permanent candidate"], included: ["FIRST_NAME", "USER_SEND_FULL_NAME", "JOB_TITLE", "SENDER_COMPANY", "LINK"], omitted: locationOmitted, explanation: "Permanent and temporary candidates receive direct candidate-facing copy. The sending service can use a contract-specific template ID." };
    }
    case "confirmation": {
      if (recipient === "consultancy") return { subject: `${format === "video" ? "Video interview" : "Interview"} confirmed`, eyebrow: "Confirmed interview", paragraphs: [hello, `The interview of ${participantName} with ${senderName} from ${companyName} for “${jobTitle}” has been confirmed.`, format === "video" ? `It takes place on ${DATE}, ${TIME}. Please forward the secure room link to ${participantName}.` : `It takes place on ${DATE}, ${TIME}, at the address below.`], details: locationDetails(format), cta: format === "video" ? "Open secure interview link" : "View interview", route: [...route, "Branch: consultancy", format === "video" ? "Use OUTSIDE_LINK" : "Use address fields"], included: ["FIRST_NAME", "CONSULTANT_FULL_NAME", "FULL_NAME", "MISSION_TITLE", "DATE", "TIME", ...locationIncluded], omitted: locationOmitted, explanation: "The consultancy video branch uses an outside link because the agency may forward it to the consultant." };
      const clientPermanent = recipient === "client" && context.clientIntervieweePermanent;
      const relationship = recipient === "client" ? `The interview of ${participantName} for “${jobTitle}” has been confirmed.` : `Your interview with ${senderName} regarding “${jobTitle}” is confirmed.`;
      return { subject: `${format === "video" ? "Video interview" : "Interview"} confirmation`, eyebrow: "Confirmed interview", paragraphs: [hello, relationship, format === "video" ? "Use the secure link below when it is time to join. Check your headphones, microphone, and webcam beforehand." : "The interview will take place at the following address."], details: [{ label: "Participant", value: participantName }, { label: "Date & time", value: `${DATE}, ${TIME}` }, ...locationDetails(format)], cta: format === "video" ? "Enter virtual meeting room" : "View interview details", route: [...route, recipient === "client" ? `Client content; interviewee ${clientPermanent ? "is" : "is not"} permanent` : `Branch: ${recipient}`, format === "video" ? "Video template selected" : "Onsite template selected"], included: ["FIRST_NAME", "FULL_NAME", "MISSION_TITLE", "DATE", "TIME", ...locationIncluded], omitted: locationOmitted, explanation: "Confirmation is the most recipient-sensitive template. It combines account type, interviewee type for clients, and location format." };
    }
    case "accepted": {
      const consultantCopy = recipient === "consultancy" || (recipient === "client" && context.hasConsultant);
      return { subject: "Interview slot accepted", eyebrow: "The proposed time was accepted", paragraphs: [hello, format === "video" ? `${consultantCopy ? `The video interview of ${participantName}` : "Your video interview"} with ${senderName} is planned on ${DATE} at 10:30.` : consultantCopy ? `The interview of ${participantName} for “${jobTitle}” has been confirmed. ${participantName} will be present at the selected address on ${DATE} at 10:30.` : `${participantName} accepted the interview time and will be present at the selected address on ${DATE} at 10:30.`, ...(format === "video" ? ["Check your headphones, microphone, and webcam before joining."] : [])], details: locationDetails(format), cta: format === "video" ? "Enter virtual meeting room" : "View interview", route: [...route, consultantCopy ? "Consultant-specific copy" : "Generic participant copy"], included: ["FIRST_NAME_RECP", "FULL_NAME", "DATE", "TIME", ...(consultantCopy ? ["CONSULTANT_FULL_NAME"] : []), ...locationIncluded], omitted: locationOmitted, explanation: "Accepted notifications tell the other party the slot is now firm. Consultant-specific wording is used when a consultant relationship exists." };
    }
    case "declined": {
      route.push("Meaning: alternative date/location proposed, not a final refusal");
      if (recipient === "permanent") return { subject: `Updated interview proposal for ${jobTitle}`, eyebrow: "Review the changed date or location", paragraphs: [hello, context.hasCompany ? `I changed the date or location for your interview for “${jobTitle}”. Please review and reply below.\n\nKind regards,\n${senderName}\n${companyName}` : `${senderName} proposed another date or location for “${jobTitle}”. Please review and reply in Wiggli.`], cta: "Review interview invitation", route: [...route, context.hasCompany ? "SENDER_COMPANY present" : "SENDER_COMPANY absent"], included: ["FIRST_NAME", "REQUEST_TITLE", "USER_SEND_FULL_NAME", ...(context.hasCompany ? ["SENDER_COMPANY"] : [])], omitted: locationOmitted, explanation: "The legacy event is called declined, but it means rescheduled. Company presence changes the tone and signature." };
      if (recipient === "freelancer") return { subject: `Alternative interview time for ${jobTitle}`, eyebrow: "A new date or location was proposed", paragraphs: [hello, `${senderName} proposed an alternative interview time for “${jobTitle}”: ${DATE}, ${TIME}.`, ...(context.isBid && format === "onsite" ? [`The interview will happen at ${ADDRESS}.`] : []), ...(!context.isBid ? ["Please review and reply to the new proposition in Wiggli."] : [])], cta: "View application", route: [...route, context.isBid ? "IS_BID=true" : "IS_BID=false", context.isBid && format === "onsite" ? "Include location" : "Do not include location"], included: ["FIRST_NAME", "REQUEST_TITLE", "DATE", "START_TIME", "END_TIME", ...(context.isBid ? ["IS_BID"] : []), ...(context.isBid && format === "onsite" ? ["INTERVIEW_ADDRESS", "CITY", "COUNTRY"] : [])], omitted: context.isBid && format === "onsite" ? ["VIDEO_CONFERENCE"] : ["INTERVIEW_ADDRESS", "VIDEO_CONFERENCE"], explanation: "Freelancer reschedules have three branches: bid with address, bid without address, or generic non-bid." };
      return { subject: `Alternative interview proposed for ${jobTitle}`, eyebrow: "A new time requires review", paragraphs: [hello, context.hasConsultant ? `${senderName} proposed an alternative time for the interview of ${participantName} for “${jobTitle}”.` : `An alternative interview time was proposed for “${jobTitle}”.`, `New proposal: ${DATE}, ${TIME}.`], cta: "Review proposal", route: [...route, context.hasConsultant ? "CONSULTANT_NAME present" : "Generic message"], included: ["FIRST_NAME", "REQUEST_TITLE", "DATE", ...(context.hasConsultant ? ["CONSULTANT_NAME"] : [])], omitted: locationOmitted, explanation: "Client and consultancy branches become consultant-specific only when a consultant name is available." };
    }
    case "refused": return { subject: "Interview refused", eyebrow: "The request was rejected", paragraphs: [hello, context.isDirect ? `Unfortunately, ${companyName} refused the interview request for ${participantName} on “${jobTitle}”.` : `Unfortunately, ${companyName} canceled the interview request initially sent for “${jobTitle}”.`, "Reason: The participant is no longer available for this process.", context.isDirect ? "You can review the other bidders for this request." : "You can explore other opportunities on Wiggli."], cta: context.isDirect ? "View list of bidders" : "Search opportunities", route: [...route, context.isDirect ? "TYPE=client" : "TYPE is not client"], included: ["FIRST_NAME", "TYPE", "CONSULTANT_FULL_NAME", "JOB_TITLE", "DESCRIPTION", "COMPANY_NAME"], omitted: ["DATE", "VIDEO_CONFERENCE", "INTERVIEW_ADDRESS"], explanation: "Refused is the true rejection path. TYPE determines whether the recipient is directed to other bidders or other opportunities." };
    case "canceled": {
      const reason = context.hasReason ? "Reason: The hiring manager is unexpectedly unavailable." : "";
      if (recipient === "permanent" || recipient === "temporary") return { subject: `Interview canceled for ${jobTitle}`, eyebrow: "This interview will not take place", paragraphs: [hello, context.hasCompany ? `Unfortunately, your interview for “${jobTitle}” has been canceled by ${companyName}.` : `Unfortunately, your interview with ${senderName} for “${jobTitle}” has been canceled.`, ...(reason ? [reason] : [])], route: [...route, context.hasCompany ? "CLIENT_COMPANY_NAME present" : "Direct sender", context.hasReason ? "CANCEL_REASON included" : "CANCEL_REASON omitted"], included: ["FIRST_NAME", "APPLICATION_TITLE", ...(context.hasCompany ? ["CLIENT_COMPANY_NAME"] : ["USER_SEND_FULL_NAME"]), ...(context.hasReason ? ["CANCEL_REASON"] : [])], omitted: context.hasReason ? [] : ["CANCEL_REASON"], explanation: "Candidate cancellation copy changes according to whether a company identity and cancellation reason are available." };
      return { subject: `Interview invitation canceled for ${jobTitle}`, eyebrow: "This interview will not take place", paragraphs: [hello, `${senderName} canceled the interview invitation regarding “${jobTitle}”.`, ...(reason && recipient === "client" && context.isDirect ? [reason] : [])], cta: recipient === "client" && context.isDirect ? "Propose another interview" : "View bid", route: [...route, recipient === "client" && context.isDirect ? "POKE_ID present: direct invitation" : "Bid-based cancellation", context.hasReason ? "CANCEL_REASON present" : "No reason"], included: ["FIRST_NAME", "USER_SEND_FULL_NAME", "APPLICATION_TITLE", ...(context.isDirect ? ["POKE_ID"] : []), ...(context.hasReason ? ["CANCEL_REASON"] : [])], omitted: ["VIDEO_CONFERENCE", "INTERVIEW_ADDRESS"], explanation: "Clients with a direct invitation get a rebook action. Bid-based recipients return to the bid instead." };
    }
    case "expired": {
      const isPermanent = recipient === "permanent";
      const expiredMessage = isPermanent
        ? `Unfortunately, the interview proposition regarding “${jobTitle}” is overdue.`
        : format === "video"
          ? `The video interview ${recipient === "consultancy" ? `with ${participantName} for “${jobTitle}”` : `with ${senderName}`} is overdue. It was planned on ${DATE} at 10:30.`
          : `The interview request is overdue. It was supposed to take place at ${ADDRESS} on ${DATE} at 10:30.`;
      return { subject: format === "video" && !isPermanent ? "Video interview proposition is overdue" : "Interview proposition expired", eyebrow: "No response was recorded before the proposed time", paragraphs: [hello, expiredMessage, "Please propose a new date and time to continue."], cta: "Propose another date", route: [...route, isPermanent ? "RECIPIENT_TYPE=permanent" : "RECIPIENT_TYPE is not permanent", !isPermanent ? (format === "video" ? "VIDEO_CONFERENCE present" : "VIDEO_CONFERENCE absent") : `ACCOUNT_TYPE=${recipient}`], included: ["FIRST_NAME", "MISSION_TITLE", ...(isPermanent ? ["RECIPIENT_TYPE"] : ["DATE", "TIME", ...locationIncluded])], omitted: locationOmitted, explanation: "Expiration first splits permanent from non-permanent recipients. Non-permanent emails then split by format and account type." };
    }
    case "archived": return { subject: `Interview archived: ${jobTitle}`, eyebrow: "Administrative notification", paragraphs: [hello, `The interview for “${jobTitle}” has been archived. Its history remains available in the candidate timeline, but it is no longer active.`], cta: "View interview history", route: [...route, "Render custom MESSAGE without further branching"], included: ["FIRST_NAME", "MESSAGE"], omitted: ["DATE", "LOCATION_TYPE", "VIDEO_CONFERENCE"], explanation: "Archived is deliberately flexible: the system supplies one custom message and no account- or location-specific branch is evaluated." };
    case "external": return { subject: "Interview notification (external participant)", eyebrow: "You were added without a Wiggli account", paragraphs: ["Hi,", `${senderName} organised an interview between you and ${participantName}. It will take place at ${ADDRESS} on ${DATE} at 10:30.`], route: [...route, "Static external template"], included: ["MANAGER_NAME", "NAME_FREELANCER", "ADDRESS", "DATE_INTERVIEW"], omitted: ["ACCOUNT_TYPE", "LINK_APPLICATION"], explanation: "External recipients cannot be routed to an authenticated application, so they receive a simple static notification." };
    case "awaiting": return { subject: `Reminder: interview response needed for ${jobTitle}`, eyebrow: "The proposed time is less than 24 hours away", paragraphs: [hello, `You have not replied to an interview proposition for “${jobTitle}”. The proposed date is within the next 24 hours, so a quick response would be appreciated.`], cta: "Go to interview proposition", route: [...route, "response_status=pending", "starts_at is within 24 hours", "Reminder has not already been sent"], included: ["FIRST_NAME", "MISSION_TITLE", "LINK_VIEW_BID"], omitted: ["VIDEO_CONFERENCE", "INTERVIEW_ADDRESS"], explanation: "This is a scheduled state check, not a user action. It must be idempotent so the same reminder is not sent repeatedly." };
    case "done": return { subject: `How did the interview with ${participantName} go?`, eyebrow: "Follow-up action is due", paragraphs: [hello, `According to our records, you had an interview on ${DATE} with ${participantName} for “${jobTitle}”.`, `How did it go? Please provide feedback, make an offer, schedule another interview, or refuse the application.`], cta: "Record interview outcome", route: [...route, "interview ended 24 hours ago", "No outcome has been recorded"], included: ["FIRST_NAME", "INTERVIEW_DATE", "VENDOR_FULL_NAME", "MISSION_TITLE", "VENDOR_FIRST_NAME"], omitted: ["VIDEO_CONFERENCE", "INTERVIEW_ADDRESS"], explanation: "This reminder closes the operational loop after an interview and should stop once an outcome exists." };
    case "admin48": return { subject: `No action 48h after interview: ${jobTitle}`, eyebrow: "Internal support alert", paragraphs: ["Dear Support,", `An interview finished more than 48 hours ago and the client has taken no action.`, `Client: ${companyName} / ${senderName}\nParticipant: ${participantName}\nRequest: RD-2048 — ${jobTitle}\nInterview: ${DATE}, ${TIME}\nComment: No feedback submitted.`], route: [...route, "interview ended more than 48 hours ago", "decision is empty", "Send only to super admins"], included: ["CLIENT_COMPANY_NAME", "CLIENT_FULL_NAME", "ACCOUNT_TYPE", "VENDOR_FULL_NAME", "JOB_REF", "START_DATE", "COMMENT"], omitted: ["VIDEO_CONFERENCE", "INTERVIEW_ADDRESS"], explanation: "This is an internal escalation, not participant communication. It requires a background scheduler and a no-action query." };
    case "expiredAdmin": return { subject: `Expired interview proposition: ${jobTitle}`, eyebrow: "Internal support alert", paragraphs: ["Dear Support,", "An interview proposition expired without a response.", `Client: ${companyName} / ${senderName}\nParticipant: ${participantName}\nRequest: RD-2048 — ${jobTitle}\nLast proposal: ${DATE}, ${TIME}\nCreated by: ${senderName}`], route: [...route, "proposal expired", "response remained pending", "Send only to super admins"], included: ["CLIENT_COMPANY_NAME", "CLIENT_FULL_NAME", "ACCOUNT_TYPE", "VENDOR_FULL_NAME", "JOB_REF", "START_DATE", "NAME_INTERVIEWER"], omitted: ["VIDEO_CONFERENCE", "INTERVIEW_ADDRESS"], explanation: "The expired admin alert provides support with enough context to investigate a stalled hiring process." };
  }
}

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail: string }) {
  return <button type="button" className={styles.toggleRow} onClick={() => onChange(!checked)} aria-pressed={checked}><span className={`${styles.switch} ${checked ? styles.switchOn : ""}`}><i /></span><span><strong>{label}</strong><small>{detail}</small></span></button>;
}

export default function EmailingTestingPage() {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("invitation");
  const [recipient, setRecipient] = useState<Recipient>("permanent");
  const [format, setFormat] = useState<Format>("video");
  const [hasCompany, setHasCompany] = useState(true);
  const [hasConsultant, setHasConsultant] = useState(true);
  const [isBid, setIsBid] = useState(true);
  const [hasReason, setHasReason] = useState(true);
  const [isDirect, setIsDirect] = useState(true);
  const [clientIntervieweePermanent, setClientIntervieweePermanent] = useState(false);
  const [recipientName, setRecipientName] = useState("Serena");
  const [participantName, setParticipantName] = useState("Serena El Amrani");
  const [jobTitle, setJobTitle] = useState("R&D Chemistry Specialist");

  const scenario = scenarios.find((item) => item.key === scenarioKey) ?? scenarios[0];
  const context: Context = { recipient, format, hasCompany, hasConsultant, isBid, hasReason, isDirect, clientIntervieweePermanent, recipientName, participantName, senderName: "Axelle Bastin", companyName: "Jacquet SCRL", jobTitle };
  const result = buildEmail(scenario, context);

  const chooseScenario = (next: Scenario) => {
    setScenarioKey(next.key);
    if (!next.recipients.includes(recipient)) setRecipient(next.recipients[0]);
  };

  const showCompany = (scenarioKey === "declined" && recipient === "permanent") || (scenarioKey === "canceled" && (recipient === "permanent" || recipient === "temporary"));
  const showConsultant = (scenarioKey === "accepted" && recipient === "client") || (scenarioKey === "declined" && (recipient === "client" || recipient === "consultancy"));
  const showBid = scenarioKey === "declined" && recipient === "freelancer";
  const showReason = scenarioKey === "canceled";
  const showDirect = scenarioKey === "refused" || (scenarioKey === "canceled" && recipient === "client");
  const showPermanentInterviewee = scenarioKey === "confirmation" && recipient === "client";

  return (
    <>
      <Header kicker={<><span className="kicker-muted">Settings / </span>Emailing (Testing)</>} />
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.overline}><MailCheck size={15} /> Interview email logic lab</span>
            <h1>See exactly why every email is sent.</h1>
            <p>Choose a lifecycle event, recipient, and context. The lab follows the legacy decision tree, renders the resulting email, and exposes every branch and merge variable.</p>
          </div>
          <div className={styles.heroStats}>
            <div><strong>13</strong><span>email events</span></div>
            <div><strong>7</strong><span>recipient classes</span></div>
            <div><strong>2</strong><span>location branches</span></div>
          </div>
        </section>

        <section className={styles.workspace}>
          <aside className={styles.scenarioRail}>
            <div className={styles.panelHeading}><span>1</span><div><strong>Choose the event</strong><small>This is the first routing decision.</small></div></div>
            <div className={styles.scenarioList}>
              {scenarios.map((item) => <button type="button" key={item.key} className={item.key === scenarioKey ? styles.scenarioActive : ""} onClick={() => chooseScenario(item)}><i>{item.short}</i><span><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight size={15} /></button>)}
            </div>
          </aside>

          <div className={styles.controls}>
            <div className={styles.panelHeading}><span>2</span><div><strong>Set the conditions</strong><small>Only conditions used by this template are shown.</small></div></div>
            <div className={styles.controlSection}>
              <label>Who receives this email?</label>
              <div className={styles.segmentGrid}>
                {scenario.recipients.map((item) => <button type="button" key={item} className={recipient === item ? styles.segmentActive : ""} onClick={() => setRecipient(item)}><UserRound size={14} />{recipientLabels[item]}</button>)}
              </div>
            </div>
            {scenario.usesFormat && <div className={styles.controlSection}><label>Interview format</label><div className={styles.formatGrid}><button type="button" className={format === "video" ? styles.formatActive : ""} onClick={() => setFormat("video")}><Video size={18} /><span><strong>Video conference</strong><small>Meeting URL is present</small></span>{format === "video" && <Check size={15} />}</button><button type="button" className={format === "onsite" ? styles.formatActive : ""} onClick={() => setFormat("onsite")}><MapPin size={18} /><span><strong>Onsite</strong><small>Physical address is present</small></span>{format === "onsite" && <Check size={15} />}</button></div></div>}
            {(showCompany || showConsultant || showBid || showReason || showDirect || showPermanentInterviewee) && <div className={styles.controlSection}><label>Context flags</label><div className={styles.toggleList}>{showCompany && <Toggle checked={hasCompany} onChange={setHasCompany} label="Company sender exists" detail="Controls formal company copy and signature" />}{showConsultant && <Toggle checked={hasConsultant} onChange={setHasConsultant} label="Consultant name exists" detail="Enables consultant-specific wording" />}{showBid && <Toggle checked={isBid} onChange={setIsBid} label="Interview comes from a bid" detail="Changes CTA and location rules" />}{showReason && <Toggle checked={hasReason} onChange={setHasReason} label="Cancellation reason provided" detail="Adds the optional reason paragraph" />}{showDirect && <Toggle checked={isDirect} onChange={setIsDirect} label={scenarioKey === "refused" ? "Refused by client" : "Direct invitation (POKE_ID)"} detail="Switches between direct and bid-based behavior" />}{showPermanentInterviewee && <Toggle checked={clientIntervieweePermanent} onChange={setClientIntervieweePermanent} label="Interviewee is permanent" detail="Selects the client permanent layout" />}</div></div>}
            <div className={styles.controlSection}>
              <label>Sample data</label>
              <div className={styles.fields}><div><span>Recipient first name</span><input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} /></div><div><span>Participant</span><input value={participantName} onChange={(event) => setParticipantName(event.target.value)} /></div><div className={styles.wideField}><span>Job / request title</span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /></div></div>
            </div>
            <div className={styles.timingCard}><Clock3 size={17} /><div><span>Send trigger</span><strong>{scenario.timing}</strong></div></div>
          </div>

          <section className={styles.output}>
            <div className={styles.panelHeading}><span>3</span><div><strong>Understand the result</strong><small>Generated from the selected branch.</small></div></div>
            <div className={styles.routeCard}>
              <div className={styles.routeTitle}><Play size={14} fill="currentColor" /> Decision path</div>
              <div className={styles.routeSteps}>{result.route.map((step, index) => <div key={`${step}-${index}`}><span>{index + 1}</span><p>{step}</p>{index < result.route.length - 1 && <ArrowRight size={13} />}</div>)}</div>
            </div>
            <article className={styles.emailCard}>
              <div className={styles.mailChrome}><div><i /><i /><i /></div><span>Generated email preview</span><MailCheck size={16} /></div>
              <div className={styles.mailMeta}><div><span>To</span><strong>{recipientName.toLowerCase().replace(/\s+/g, ".")}@example.com</strong></div><div><span>Subject</span><strong>{result.subject}</strong></div></div>
              <div className={styles.mailBody}><span className={styles.emailEyebrow}>{result.eyebrow}</span>{result.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{result.details && <dl>{result.details.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>}{result.cta && <button type="button">{result.cta}<ExternalLink size={13} /></button>}<footer><span>AB</span><div><strong>Axelle Bastin</strong><small>Senior Recruiter · Jacquet SCRL</small></div></footer></div>
            </article>
            <div className={styles.explanation}><CircleHelp size={18} /><div><strong>Why this version?</strong><p>{result.explanation}</p></div></div>
          </section>
        </section>

        <section className={styles.logicSection}>
          <div className={styles.sectionTitle}><div><span className={styles.overline}><Code2 size={14} /> Data contract</span><h2>What the renderer keeps and removes</h2><p>Presence-based conditionals work by sending values only for the selected branch. Empty values cause their content blocks to disappear.</p></div><div className={styles.logicFormula}><span>event</span><ChevronRight size={13} /><span>recipient</span><ChevronRight size={13} /><span>format</span><ChevronRight size={13} /><strong>email</strong></div></div>
          <div className={styles.variableGrid}>
            <div className={styles.variableCard}><header><Check size={16} /><div><strong>Included in this email</strong><small>Populated merge variables</small></div></header><div>{result.included.map((variable) => <code key={variable}>{variable}</code>)}</div></div>
            <div className={`${styles.variableCard} ${styles.omittedCard}`}><header><AlertTriangle size={16} /><div><strong>Explicitly omitted</strong><small>Prevents the wrong conditional block</small></div></header><div>{result.omitted.length ? result.omitted.map((variable) => <code key={variable}>{variable}</code>) : <p>No conditional variables need to be removed.</p>}</div></div>
            <div className={styles.variableCard}><header><CalendarClock size={16} /><div><strong>Automation requirement</strong><small>What must happen outside the template</small></div></header><p>{scenario.timing}. The sender must store a delivery marker to prevent duplicate transactional emails.</p></div>
          </div>
        </section>

        <section className={styles.modelSection}>
          <div className={styles.sectionTitle}><div><span className={styles.overline}><UsersRound size={14} /> Complete model</span><h2>All routing dimensions at a glance</h2></div></div>
          <div className={styles.modelGrid}>
            <div><span><MailCheck size={17} /></span><strong>Lifecycle first</strong><p>The action or scheduled state determines the email family before recipient details are considered.</p></div>
            <div><span><UserRound size={17} /></span><strong>One email per recipient</strong><p>Each recipient gets personal merge values and account-specific copy, not one shared message for the group.</p></div>
            <div><span><MapPin size={17} /></span><strong>Mutually exclusive location</strong><p>Video emails contain a room URL. Onsite emails contain address fields. Never populate both.</p></div>
            <div><span><Building2 size={17} /></span><strong>Relationship context</strong><p>Bid, consultancy, company, and direct-invitation flags select CTAs and specialized wording.</p></div>
            <div><span><Clock3 size={17} /></span><strong>Background automation</strong><p>24-hour reminders, 48-hour alerts, and expiration checks require scheduled jobs and idempotency.</p></div>
            <div><span><Send size={17} /></span><strong>Delivery is separate</strong><p>Template rendering creates content; a mail provider, status tracking, retries, and bounce handling deliver it safely.</p></div>
          </div>
        </section>
      </main>
    </>
  );
}
