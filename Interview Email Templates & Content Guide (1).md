# Interview Email Templates & Content Guide

This document catalogs all interview-related email templates sent by the system, grouped by recipient account type. Each email type lists the full content with conditional rules explained below. Conditionals show which content blocks appear based on interview properties, user settings, or account types.

---

## Account Types (Recipient Classifications)

- **`client`** — Company/recruiter posting jobs and conducting interviews
- **`freelancer`** — Independent contractor bidding on jobs
- **`consultancy`** — Agency providing candidates (consultants) for hire
- **`permanent`** — Candidate applying for permanent placement roles
- **`temporary`** — Temporary contractor or temp-to-perm candidate
- **`super_admin`** — System administrator (internal notifications only)

---

## Interview Location Types (Conditional Triggers)

Two core interview format conditions drive email variants:

- **`video_conference`** — Remote interview via Whereby video room (virtual meeting URL provided)
- **`search_address` / `onsite`** — In-person interview at company office (physical address provided)

---

## Email Types Summary

| Email | Recipients | Base Conditions | Source Files |
|-------|-----------|-----------------|--------------|
| **Interview Invitation** | Freelancer, Permanent, Consultancy | Video vs. Onsite | `interview_email.html` |
| **Interview Confirmation** | Client, Freelancer, Consultancy, Permanent | Account Type + Video vs. Onsite | `interview_confirmation_email.html` |
| **Interview Accepted** | All except Permanent | Video vs. Onsite | `interview_accepted_email.html` |
| **Interview Declined** | Permanent, Freelancer, Consultancy, Client | Account Type + Bid vs. Direct | `interview_declined_email.html` |
| **Interview Refused** | Freelancer, Consultancy | Type + Video vs. Onsite | `interview_refused_email.html` |
| **Interview Canceled** | Permanent, Client, Freelancer, Consultancy | Account Type + Cancel Reason | `interview_canceled_email.html` |
| **Interview Expired** | Freelancer, Consultancy, Permanent, Client | Account Type + Video vs. Onsite | `interview_expired_email.html` |
| **Interview Archived** | Any | Custom message | `interview_archived_email.html` |
| **Interview External** | External (non-platform) | Static | `interview_external_email.html` |
| **Interview Reminder (Awaiting Response)** | Freelancer, Client, Consultancy | Static | `reminder_interview_email.html` |
| **Done Interview Reminder** | Freelancer, Consultancy | Static | `reminder_done_interview_email.html` |
| **Done Interview Reminder (48h Admin Alert)** | Super Admin | Static | `reminder_done_interview_forty_eight_hours_email.html` |
| **Expired Interview Admin Alert** | Super Admin | Static | `recap_expired_interview_to_inform_admin_email.html` |

---

## 1. Interview Invitation Email

**Template:** `data/email/template/interview_email.html`  
**Recipients:** Freelancer, Permanent, Consultancy  
**Key Merge Variables:** `FIRST_NAME`, `USER_SEND_FULL_NAME`, `JOB_TITLE`, `DATE`, `START_TIME`, `END_TIME`, `LINK`, `SENDER_COMPANY`, `CONSULTANT_FULL_NAME`, `VIDEO_CONFERENCE`, `TYPE`

### Content Variants

#### For **Freelancer** Recipients
```
Hello *|FIRST_NAME|*,

*|USER_SEND_FULL_NAME|* has invited you to an interview regarding your application on the job "*|JOB_TITLE|*".
The proposed interview is to take place on *|DATE|* from *|START_TIME|* to *|END_TIME|*.

[Button] View Application
```

#### For **Permanent** Recipients
```
Hello *|FIRST_NAME|*,

I would like to organise an interview with you for the role of (*|JOB_TITLE|*).
Please review and reply to my invitation using the button below.

[Button] View interview invitation

Kind regards,
*|USER_SEND_FULL_NAME|*
*|SENDER_COMPANY|*
```

#### For **Consultancy** Recipients
```
Hello *|FIRST_NAME|*,

*|USER_SEND_FULL_NAME|* from *|SENDER_COMPANY|* has requested an interview with your consultant *|CONSULTANT_FULL_NAME|*
regarding the bid made on the request "*|JOB_TITLE|*".

IF VIDEO CONFERENCE:
  The video interview is to take place on *|DATE|* from *|START_TIME|* to *|END_TIME|* in a virtual meeting room.
  You'll receive a link allowing you to join the video interview once it is confirmed.
ELSE:
  The proposed interview is to take place on *|DATE|* from *|START_TIME|* to *|END_TIME|*.
END IF

To reply to this interview proposition, [Link: go to the application].
```

**Conditional Rules:**
- **Content block 1 (Freelancer section)** — Triggered by: `TYPE=freelancer`
- **Content block 2 (Permanent section)** — Triggered by: `TYPE=permanent`
- **Content block 3 (Consultancy section)** — Triggered by: Neither freelancer nor permanent (else)
  - **Nested video block** — Triggered by: `VIDEO_CONFERENCE` variable present
  - **Nested onsite block** — Triggered by: `VIDEO_CONFERENCE` variable absent

---

## 2. Interview Confirmation Email

**Template:** `data/email/template/interview_confirmation_email.html`  
**Recipients:** Client, Freelancer, Consultancy, Permanent  
**Key Merge Variables:** `FIRST_NAME`, `FULL_NAME`, `MISSION_TITLE`, `DATE`, `TIME`, `END_TIME`, `VIDEO_CONFERENCE`, `COMPANY_NAME`, `INTERVIEW_ADDRESS`, `CITY`, `COUNTRY`, `INTERVIEWER`, `CONSULTANT_FULL_NAME`, `OUTSIDE_LINK`, `CLIENTS_NAME`, `ACCOUNT_TYPE`, `RECIPIENT_TYPE`

### Content Variants

#### For **Client** Recipients, **Video Conference**
**Onsite variant title:**
```
[Title] Video Interview Confirmed
```

**Video content (non-permanent recipient):**
```
Dear *|FIRST_NAME|*,

The interview of *|FULL_NAME|* for the request "*|MISSION_TITLE|*" has been confirmed.

The video interview is to take place on *|DATE|* from *|TIME|* to *|END_TIME|* in a virtual meeting room
which you can access directly [Link: from the application page].
```

**Video content (permanent recipient):**
```
Your interview with *|FULL_NAME|* regarding the position of "*|MISSION_TITLE|*" is confirmed.

| Location:     | Video Interview (Virtual Meeting Room) |
| Date & Time:  | *|DATE|* at *|TIME|*                  |

To join the virtual interview room, make sure you have a working set of headphones, microphone and webcam,
then click on the link below:

[Button] ENTER VIRTUAL MEETING ROOM
```

#### For **Client** Recipients, **Onsite**

**Onsite title:**
```
[Title] Interview confirmation
```

**Non-permanent recipient content:**
```
Dear *|FIRST_NAME|*,

An interview for the mission of "*|MISSION_TITLE|*" has been confirmed.

| Applicant:    | *|FULL_NAME|*               |
| Interviewer:  | *|INTERVIEWER|*             |
| Date & Time:  | *|DATE|* at *|TIME|*        |
| Location:     | *|COMPANY_NAME|*            |
|               | *|INTERVIEW_ADDRESS|*       |
|               | *|CITY|* *|COUNTRY|*        |
```

**Permanent recipient content:**
```
Dear *|FIRST_NAME|*,

Your interview with *|FULL_NAME|* regarding the position of "*|MISSION_TITLE|*" is confirmed.

*|DATE|* at *|TIME|*

*|COMPANY_NAME|*
*|INTERVIEW_ADDRESS|*
*|CITY|* *|COUNTRY|*
```

#### For **Freelancer** Recipients

**Video conference:**
```
Dear *|FIRST_NAME|*,

Your video interview with *|FULL_NAME|* is planned on *|DATE|* at *|TIME|*.

To join the virtual interview room, make sure you have a working set of headphones, microphone and webcam,
then click on the link below:

[Button] ENTER VIRTUAL MEETING ROOM
```

**Onsite:**
```
Dear *|FIRST_NAME|*,

The interview planned for the mission of "*|MISSION_TITLE|*" has been confirmed.

Your interview with *|FULL_NAME|*, is planned on *|DATE|* at *|TIME|* at the following location:

*|COMPANY_NAME|*
*|INTERVIEW_ADDRESS|*
*|CITY|* *|COUNTRY|*
```

#### For **Consultancy** Recipients

**Video conference:**
```
Dear *|FIRST_NAME|*,

The interview of *|CONSULTANT_FULL_NAME|* with *|FULL_NAME|* from *|COMPANY_NAME|* for the request "*|MISSION_TITLE|*"
has been confirmed.

The video interview is to take place on *|DATE|* from *|TIME|* to *|END_TIME|* in a virtual meeting room
which *|CONSULTANT_FULL_NAME|* can access via the link below (please forward him/her this email or copy/paste the link to send it).

[Link] *|OUTSIDE_LINK|*
```

**Onsite:**
```
Dear *|FIRST_NAME|*,

The interview planned for the mission of *|MISSION_TITLE|* has been confirmed.

The interview of *|CONSULTANT_FULL_NAME|* with *|FULL_NAME|*, is planned on *|DATE|* at *|TIME|* at the following location:

*|COMPANY_NAME|*
*|INTERVIEW_ADDRESS|*
*|CITY|* *|COUNTRY|*
```

#### For **Permanent** Recipients

**Video conference:**
```
Dear *|FIRST_NAME|*,

Your interview with *|CLIENTS_NAME|* regarding the position of "*|MISSION_TITLE|*" is confirmed.

| Location:     | Video Interview (Virtual Meeting Room) |
| Date & Time:  | *|DATE|* at *|TIME|*                  |

To join the virtual interview room, make sure you have a working set of headphones, microphone and webcam,
then click on the link below:

[Button] ENTER VIRTUAL MEETING ROOM
```

**Onsite:**
```
Dear *|FIRST_NAME|*,

Your interview with *|CLIENTS_NAME|* regarding the position of "*|MISSION_TITLE|*" is confirmed.

*|DATE|* at *|TIME|*

*|COMPANY_NAME|*
*|INTERVIEW_ADDRESS|*
*|CITY|* *|COUNTRY|*
```

**Conditional Rules:**
- **Primary split by `ACCOUNT_TYPE`:**
  - `ACCOUNT_TYPE=client` → Client section
  - `ACCOUNT_TYPE=freelancer` → Freelancer section
  - `ACCOUNT_TYPE=consultancy` → Consultancy section
  - `ACCOUNT_TYPE=permanent` → Permanent section

- **Secondary split by `VIDEO_CONFERENCE`:**
  - `VIDEO_CONFERENCE` variable is populated → Video interview branch
  - `VIDEO_CONFERENCE` variable is absent/empty → Onsite branch

- **Tertiary split on `RECIPIENT_TYPE!=permanent`:**
  - For **Client** section only: if recipient is NOT permanent, show simplified non-permanent content; if recipient IS permanent, show alternate permanent-specific content with table layout

- **Special case for Consultancy video:** Uses `OUTSIDE_LINK` instead of `VIDEO_CONFERENCE` (video room URL intended for forwarding to consultant)

---

## 3. Interview Accepted Email

**Template:** `data/email/template/interview_accepted_email.html`  
**Recipients:** Client, Freelancer, Consultancy  
**Key Merge Variables:** `FIRST_NAME_RECP`, `FULL_NAME`, `DATE`, `TIME`, `VIDEO_CONFERENCE`, `ACCOUNT_TYPE`, `CONSULTANT_FULL_NAME`, `CONSULTANT_FIRST_NAME`, `MISSION_TITLE`, `ADDRESS`, `DATE_INTERVIEW`

### Content Variants

#### For **Client** Recipients

**Video conference:**
```
[Title] Interview slot accepted

Dear *|FIRST_NAME_RECP|*,

Your video interview with *|FULL_NAME|* is planned on *|DATE|* at *|TIME|*.

To join the virtual interview room, make sure you have a working set of headphones, microphone and webcam,
then click on the link below:

[Button] ENTER VIRTUAL MEETING ROOM
```

**Onsite (with consultant name):**
```
[Title] Interview slot accepted

Dear *|FIRST_NAME_RECP|*,

The interview of *|CONSULTANT_FULL_NAME|* for the request "*|MISSION_TITLE|*" has been confirmed.
*|CONSULTANT_FIRST_NAME|* will be present in *|ADDRESS|* at *|DATE_INTERVIEW|*.
```

**Onsite (generic):**
```
[Title] Interview slot accepted

Dear *|FIRST_NAME_RECP|*,

*|FIRST_NAME|* has accepted the time and date of interview.

*|FIRST_NAME|* will be present in *|ADDRESS|* at *|DATE_INTERVIEW|*.
```

#### For **Freelancer** Recipients

**Video conference:**
```
[Title] Interview slot accepted

Dear *|FIRST_NAME_RECP|*,

Your video interview with *|FULL_NAME|* is planned on *|DATE|* at *|TIME|*.

To join the virtual interview room, make sure you have a working set of headphones, microphone and webcam,
then click on the link below:

[Button] ENTER VIRTUAL MEETING ROOM
```

**Onsite:**
```
[Title] Interview slot accepted

Dear *|FIRST_NAME_RECP|*,

*|FIRST_NAME|* has accepted the time and date of interview.

*|FIRST_NAME|* will be present in *|ADDRESS|* at *|DATE_INTERVIEW|*.
```

#### For **Consultancy** Recipients

**Video conference:**
```
[Title] Interview slot accepted

Dear *|FIRST_NAME_RECP|*,

The video interview of *|CONSULTANT_FULL_NAME|* with *|FULL_NAME|* is planned on *|DATE|* at *|TIME|*.

To join the virtual interview room, make sure you have a working set of headphones, microphone and webcam,
then click on the link below:

[Button] ENTER VIRTUAL MEETING ROOM
```

**Onsite:**
```
[Title] Interview slot accepted

Dear *|FIRST_NAME_RECP|*,

The interview of *|CONSULTANT_FULL_NAME|* for the request "*|MISSION_TITLE|*" has been confirmed.
*|FIRST_NAME|* will be present in *|ADDRESS|* at *|DATE_INTERVIEW|*.
```

**Conditional Rules:**
- **Primary split by `ACCOUNT_TYPE`:**
  - `ACCOUNT_TYPE=client` → Client branch
  - `ACCOUNT_TYPE=freelancer` → Freelancer branch
  - `ACCOUNT_TYPE=consultancy` → Consultancy branch

- **Secondary split by `VIDEO_CONFERENCE`:**
  - `VIDEO_CONFERENCE` variable present → Video content
  - `VIDEO_CONFERENCE` absent → Onsite content

- **Tertiary (Client/Consultancy onsite only):**
  - If `CONSULTANT_FULL_NAME` is populated → Show consultant-specific message
  - Else → Show generic "First Name" message

---

## 4. Interview Declined Email (Alternative Date/Location Proposed)

**Template:** `data/email/template/interview_declined_email.html`  
**Recipients:** Permanent, Freelancer, Consultancy, Client  
**Key Merge Variables:** `FIRST_NAME`, `ACCOUNT_TYPE`, `SENDER_COMPANY`, `REQUEST_TITLE`, `USER_SEND_FULL_NAME`, `LINK_APPLICATION`, `CONSULTANT_NAME`, `MISSION_TITLE`, `DATE`, `START_TIME`, `END_TIME`, `IS_BID`, `LOCATION_TYPE`, `INTERVIEW_ADDRESS`, `CITY`, `COUNTRY`

### Content Variants

#### For **Permanent** Recipients

**With company sender:**
```
Dear *|FIRST_NAME|*,

I have changed the date/location for the interview for the role of (*|REQUEST_TITLE|*).
Please review and reply to my invitation using the button below.

[Button] Review interview invitation

Kind regards,
*|USER_SEND_FULL_NAME|*
*|SENDER_COMPANY|*
```

**Without company sender (direct):**
```
Dear *|FIRST_NAME|*,

*|USER_SEND_FULL_NAME|* has proposed another date/location for the interview regarding the position of "*|REQUEST_TITLE|*".

Please review and reply to the proposition via your interface.

[Button] Review interview invitation
```

#### For **Freelancer** Recipients

**If bid + location specified:**
```
Dear *|FIRST_NAME|*,

*|USER_SEND_FULL_NAME|* has just proposed an alternative time regarding the interview for the request "*|REQUEST_TITLE|*".

The alternative interview time proposed is: *|DATE|* from *|START_TIME|* to *|END_TIME|*.

The interview will happen at following location:
*|INTERVIEW_ADDRESS|*
*|CITY|* *|COUNTRY|*

[Button] View Application
```

**If bid without location:**
```
Dear *|FIRST_NAME|*,

*|USER_SEND_FULL_NAME|* has just proposed an alternative time regarding the interview for the request "*|REQUEST_TITLE|*".

The alternative interview time proposed is: *|DATE|* from *|START_TIME|* to *|END_TIME|*.

[Button] View Application
```

**Generic (non-bid):**
```
Dear *|FIRST_NAME|*,

*|USER_SEND_FULL_NAME|* has proposed another date/time for the interview regarding the position of "*|REQUEST_TITLE|*".

Please review and reply to the proposition via your interface.

[Button] View Application
```

#### For **Consultancy** Recipients

**If consultant name specified:**
```
Dear *|FIRST_NAME|*,

*|USER_SEND_FULL_NAME|* has just proposed an alternative time regarding the interview of *|CONSULTANT_NAME|* for the request "*|REQUEST_TITLE|*".

The alternative interview time proposed is: *|DATE|* from *|START_TIME|* to *|END_TIME|*.
```

#### For **Client** Recipients

**If consultant name specified:**
```
Dear *|FIRST_NAME|*,

An alternative time has been proposed for the interview of *|USER_SEND_FULL_NAME|* for the request "*|REQUEST_TITLE|*".
```

**Conditional Rules:**
- **Primary split by `ACCOUNT_TYPE`:**
  - `ACCOUNT_TYPE=permanent` → Permanent branch
  - `ACCOUNT_TYPE=freelancer` → Freelancer branch
  - `ACCOUNT_TYPE=consultancy` → Consultancy branch
  - (else) → Client branch

- **Permanent branch:**
  - If `SENDER_COMPANY` populated → Show formal company closing
  - Else → Show direct message

- **Freelancer branch:**
  - If `IS_BID` flag AND `LOCATION_TYPE=search_address` → Show bid with location variant
  - Else if `IS_BID` → Show bid without location variant
  - Else → Show generic non-bid variant

- **Consultancy/Client branches:**
  - If `CONSULTANT_NAME` populated → Show consultant-specific message
  - Else → Generic message

---

## 5. Interview Refused Email

**Template:** `data/email/template/interview_refused_email.html`  
**Recipients:** Freelancer, Consultancy  
**Key Merge Variables:** `FIRST_NAME`, `TYPE`, `NAME_TYPE`, `CONSULTANT_FULL_NAME`, `JOB_TITLE`, `DESCRIPTION`, `LINK`, `COMPANY_NAME`

### Content

```
[Title] Interview refused

Dear *|FIRST_NAME|*,

IF TYPE=client:
  Unfortunately, *|NAME_TYPE|* has refused your interview request of *|CONSULTANT_FULL_NAME|* sent for the mission "*|JOB_TITLE|*".
  Here is the reason for this cancellation : *|DESCRIPTION|*
  In order to fill your request, we suggest you to have a look at the list of other bidders : [Link: List of bidders].
ELSE:
  Unfortunately, *|NAME_TYPE|* from *|COMPANY_NAME|* has cancelled the interview request initially sent
  for the mission "*|JOB_TITLE|*".
  Here is the reason for this cancellation: *|DESCRIPTION|*
  In order to explore new opportunities, please have a look at the [Link: Search mission] section on the platform.
END IF
```

**Conditional Rules:**
- **Content split by `TYPE`:**
  - `TYPE=client` → Show "refused request" message (sent to freelancer/consultancy)
  - Else → Show "cancelled interview" message (sent to freelancer/consultancy from company)

---

## 6. Interview Canceled Email

**Template:** `data/email/template/interview_canceled_email.html`  
**Recipients:** Permanent, Client, Freelancer, Consultancy  
**Key Merge Variables:** `FIRST_NAME`, `ACCOUNT_TYPE`, `CLIENT_COMPANY_NAME`, `APPLICATION_TITLE`, `CANCEL_REASON`, `USER_SEND_FULL_NAME`, `POKE_ID`, `LINK_VIEW_APPLICATION`

### Content Variants

#### For **Permanent** Recipients

**From company (company name present):**
```
Hello *|FIRST_NAME|*,

Unfortunately, your interview for the role of (*|APPLICATION_TITLE|*) has been cancelled.

IF CANCEL_REASON:
  Here is the information attached to this cancellation:
  *|CANCEL_REASON|*
END IF

Kind regards,
*|CLIENT_COMPANY_NAME|*
```

**Direct (no company name):**
```
Hello *|FIRST_NAME|*,

Unfortunately, your interview with *|USER_SEND_FULL_NAME|* regarding the position of "*|APPLICATION_TITLE|*" has been canceled.

IF CANCEL_REASON:
  Here is the reason provided by the *|FIRST_NAME|*:
  *|CANCEL_REASON|*
END IF
```

#### For **Client** Recipients

**With poke ID (direct poke):**
```
Hello *|FIRST_NAME|*,

Unfortunately, *|USER_SEND_FULL_NAME|* has canceled the interview planned, regarding the position of "*|APPLICATION_TITLE|*".

IF CANCEL_REASON:
  Here is the reason provided by the *|FIRST_NAME|*:
  *|CANCEL_REASON|*
END IF

use the button below to organise a new interview.

[Button] PROPOSE INTERVIEW
```

**Without poke ID (bid-based):**
```
Hello *|FIRST_NAME|*,

*|USER_SEND_FULL_NAME|* has cancelled the interview invitation regarding the request "*|APPLICATION_TITLE|*".

[Button] View Bid
```

#### For **Freelancer** or **Consultancy** Recipients

```
Hello *|FIRST_NAME|*,

*|USER_SEND_FULL_NAME|* has cancelled the interview invitation regarding the request "*|APPLICATION_TITLE|*".

[Button] View Bid
```

**Conditional Rules:**
- **Primary split by `ACCOUNT_TYPE`:**
  - `ACCOUNT_TYPE=permanent` → Permanent branch
  - `ACCOUNT_TYPE=client` → Client branch
  - Else → Freelancer/Consultancy branch

- **Permanent/Client branches:**
  - If `CANCEL_REASON` populated → Append reason paragraph

- **Client branch only:**
  - If `POKE_ID` present → Show direct poke cancellation (with "Propose Interview" CTA)
  - Else → Show bid-based cancellation (with "View Bid" CTA)

---

## 7. Interview Expired Email

**Template:** `data/email/template/interview_expired_email.html`  
**Recipients:** Freelancer, Consultancy, Permanent, Client  
**Key Merge Variables:** `FIRST_NAME`, `RECIPIENT_TYPE`, `VIDEO_CONFERENCE`, `ACCOUNT_TYPE`, `INTERVIEW_WITH`, `MISSION_TITLE`, `DATE`, `TIME`, `ADDRESS`, `DATE_INTERVIEW`, `LINK_APPLICATION`

### Content Variants

#### For **Non-Permanent** Recipients

**Video conference (title):**
```
[Title] Video Interview proposition is overdue
```

**Onsite (title):**
```
[Title] Interview time is over due
```

**Video conference (Freelancer):**
```
Dear *|FIRST_NAME|*,

The video interview with *|INTERVIEW_WITH|* is over due. It was planned on *|DATE|* at *|TIME|*.

Please Click below to propose a new time and date in order to move forward.

[Button] Propose new time
```

**Video conference (Consultancy):**
```
Dear *|FIRST_NAME|*,

The video interview proposition with *|INTERVIEW_WITH|* for the mission "*|MISSION_TITLE|*" is overdue.
It was planned on *|DATE|* at *|TIME|*.

Please Click below to propose a new time and date in order to move forward.

[Button] Propose new time
```

**Onsite:**
```
Dear *|FIRST_NAME|*,

The interview request is over due. It was supposed to take place in *|ADDRESS|* at *|DATE_INTERVIEW|*.

Please Click below to propose a new time and date in order to move forward.

[Button] Propose new time
```

#### For **Permanent** Recipients

**Client:**
```
Dear *|FIRST_NAME|*,

Unfortunately, your interview proposition to *|INTERVIEW_WITH|* regarding the position of "*|MISSION_TITLE|*" is overdue.

Please propose a new date & time, using the button below.

[Button] PROPOSE ANOTHER DATE
```

**Permanent:**
```
Dear *|FIRST_NAME|*,

Unfortunately, your interview proposition regarding the position of "*|MISSION_TITLE|*" is overdue.

Please propose a new date & time, using the button below.

[Button] PROPOSE ANOTHER DATE
```

**Conditional Rules:**
- **Primary split by `RECIPIENT_TYPE`:**
  - `RECIPIENT_TYPE!=permanent` → Non-permanent branch (shows title; title shows "Video" if video, else generic)
  - `RECIPIENT_TYPE=permanent` → Permanent branch

- **Non-permanent branch:**
  - If `VIDEO_CONFERENCE` → Video conference content
  - Else → Onsite content
  - If `ACCOUNT_TYPE=freelancer` → Show freelancer-specific message
  - Else → Show generic (consultancy) message

- **Permanent branch:**
  - If `ACCOUNT_TYPE=client` → Show client-specific message
  - Else → Show permanent-specific message

---

## 8. Interview Archived Email

**Template:** `data/email/template/interview_archived_email.html`  
**Recipients:** Any (custom)  
**Key Merge Variables:** `FIRST_NAME`, `MESSAGE`

### Content

```
Dear *|FIRST_NAME|*,

*|MESSAGE|*
```

**Notes:** Fully templated with custom message; no conditional logic. Used for admin/system notifications about archived interviews.

---

## 9. Interview External Email

**Template:** `data/email/template/interview_external_email.html`  
**Recipients:** External (non-platform users)  
**Key Merge Variables:** `MANAGER_NAME`, `NAME_FREELANCER`, `ADDRESS`, `DATE_INTERVIEW`

### Content

```
[Title] Interview notification (for external to wiggli)

Hi,

*|MANAGER_NAME|* has organised an interview between you and *|NAME_FREELANCER|* that will take place in *|ADDRESS|* at *|DATE_INTERVIEW|*.
```

**Notes:** Static template for external candidates/interviewers who do not have platform accounts.

---

## 10. Interview Reminder (Awaiting Response)

**Template:** `data/email/template/reminder_interview_email.html`  
**Recipients:** Freelancer, Client, Consultancy  
**Key Merge Variables:** `FIRST_NAME`, `MISSION_TITLE`, `LINK_VIEW_BID`

### Content

```
Dear *|FIRST_NAME|*,

According to our system, you haven't replied yet to an interview proposition for the mission of "*|MISSION_TITLE|*".
The date and time proposed are within the next 24 hours so a quick feedback would be highly appreciated.
You can access and reply to that proposition via the link below.

[Link] GO TO INTERVIEW PROPOSITION
```

**Notes:** Static reminder; no conditional logic. Triggered when interview response is pending and scheduled time is within 24 hours.

---

## 11. Done Interview Reminder

**Template:** `data/email/template/reminder_done_interview_email.html`  
**Recipients:** Freelancer, Consultancy  
**Key Merge Variables:** `FIRST_NAME`, `INTERVIEW_DATE`, `VENDOR_FULL_NAME`, `MISSION_TITLE`, `VENDOR_FIRST_NAME`

### Content

```
Dear *|FIRST_NAME|*,

According to our records, you have had an interview on *|INTERVIEW_DATE|* with *|VENDOR_FULL_NAME|*
for the mission : "*|MISSION_TITLE|*".

How did it go?

Once you've made a decision, don't forget to provide a feedback to *|VENDOR_FIRST_NAME|* by either making him/her
a contract proposition; inviting him/her for another interview; or refusing his/her application.
```

**Notes:** Static reminder; no conditional logic. Sent 24 hours after interview completion.

---

## 12. Done Interview Reminder (48h Admin Alert)

**Template:** `data/email/template/reminder_done_interview_forty_eight_hours_email.html`  
**Recipients:** Super Admin  
**Key Merge Variables:** `CLIENT_COMPANY_NAME`, `CLIENT_FULL_NAME`, `ACCOUNT_TYPE`, `VENDOR_FULL_NAME`, `JOB_REF`, `START_DATE`, `COMMENT`

### Content

```
Dear Support,

Note that there has been an interview over 48 hours ago for which no action was taken by the client.

Client: *|CLIENT_COMPANY_NAME|*
       *|CLIENT_FULL_NAME|*

*|ACCOUNT_TYPE|*: *|VENDOR_FULL_NAME|*

Request Ref: *|JOB_REF|*

Interview date & time: *|START_DATE|*

Interview Comment: *|COMMENT|*

You might want to keep an eye on that.
```

**Notes:** Static admin notification; no conditional logic. Alerts support when no hiring decision made 48+ hours after interview.

---

## 13. Expired Interview Admin Alert

**Template:** `data/email/template/recap_expired_interview_to_inform_admin_email.html`  
**Recipients:** Super Admin  
**Key Merge Variables:** `CLIENT_COMPANY_NAME`, `CLIENT_FULL_NAME`, `ACCOUNT_TYPE`, `VENDOR_FULL_NAME`, `JOB_REF`, `START_DATE`, `NAME_INTERVIEWER`

### Content

```
Dear Support,

Note that there has been an interview proposition overdue.

Client: *|CLIENT_COMPANY_NAME|*
       *|CLIENT_FULL_NAME|*

*|ACCOUNT_TYPE|*: *|VENDOR_FULL_NAME|*

Request Ref: *|JOB_REF|*

Last Interview proposition: *|START_DATE|*

Made by: *|NAME_INTERVIEWER|*

You might want to keep an eye on that.
```

**Notes:** Static admin notification; no conditional logic. Alerts support when interview proposition expires without response.

---

### SendInterviewMail
- **EMAIL_NAME:** `permanent_interview_email` / `temporary_interview_email`
- **Conditionals:**
  - Splits by `recipientType` (permanent vs. temporary account type)
  - Always includes `COMPANY_ADDRESS` merge var
  - Sets activation email for unconfirmed recipients

### SendInterviewConfirmationMail
- **EMAIL_NAMEs:** 
  - `interview_confirmation_email` (generic)
  - `permanent_interview_confirmation_email` + `permanent_interview_confirmation_email_video_conference` (permanent recipient)
  - `temporary_interview_confirmation_email` + `temporary_interview_confirmation_email_video_conference` (temporary recipient)
- **Conditionals:**
  - Selects different template ID based on video vs. onsite
  - Strips address fields for video interviews; strips video room fields for onsite

### CancelInterviewMail
- **EMAIL_NAMEs:**
  - `permanent_interview_canceled_email` (permanent recipient)
  - `temporary_interview_canceled_email` (temporary recipient)
  - `interview_canceled_email` (generic fallback)
- **Conditionals:**
  - Splits by account type (permanent vs. temporary)

### DeclineInterviewMail (Rescheduled Interview Notification)
- **EMAIL_NAME:** `EventType::PERMANENT_INTERVIEW_DECLINED_EMAIL` (and variants in EventType.php)
- **Conditionals:**
  - Splits by `location_type` (video vs. onsite)
  - Strips address fields for video; strips video fields for onsite
  - Selects subject line based on interview format and account type

---

## Implementation Notes

### How Conditionals Work

Conditional content is handled in two ways:

1. **Merge-variable presence/absence** (Mandrill/Mailchimp Transactional):
   - If a merge variable is populated, the template's conditional block (`*|IF:VARIABLE|*`) renders its content.
   - If the merge variable is empty/null, the block is skipped.
   - Examples: `*|IF:VIDEO_CONFERENCE|*` only renders if the `VIDEO_CONFERENCE` variable contains a URL; `*|IF:CANCEL_REASON|*` only shows cancellation reason if provided.

2. **Variable-value comparisons** (Mandrill conditionals):
   - Templates use `*|IF:VARIABLE=value|*` to branch on account type.
   - Example: `*|IF:ACCOUNT_TYPE=client|*` shows client-specific content only.

### Merge Variables Reference

| Merge Variable | Purpose | Set When |
|---|---|---|
| `FIRST_NAME`, `FIRST_NAME_RECP` | Recipient's first name | Always |
| `FULL_NAME`, `CLIENTS_NAME` | Interviewee/interviewer full name | Interview created |
| `USER_SEND_FULL_NAME` | Sender's full name | Email sent by a user |
| `MISSION_TITLE`, `REQUEST_TITLE`, `JOB_TITLE`, `APPLICATION_TITLE` | Job/request name | Interview linked to job |
| `DATE`, `DATE_INTERVIEW`, `START_DATE` | Interview date | Interview scheduled |
| `TIME`, `START_TIME`, `END_TIME` | Interview time range | Interview scheduled |
| `VIDEO_CONFERENCE`, `OUTSIDE_LINK` | Video room URL | Video interview type |
| `INTERVIEW_ADDRESS`, `ADDRESS` | Physical interview location | Onsite interview type |
| `COMPANY_NAME`, `SENDER_COMPANY`, `CLIENT_COMPANY_NAME` | Company/recruiter name | Company linked |
| `CITY`, `COUNTRY` | Location components | Onsite interview type |
| `CONSULTANT_FULL_NAME`, `CONSULTANT_FIRST_NAME` | Consultant/bidder name | Consultancy/freelancer interview |
| `ACCOUNT_TYPE` | Recipient account type (client/freelancer/consultancy/permanent) | Email recipient determined |
| `RECIPIENT_TYPE` | Alternative recipient type classification | Email recipient determined |
| `TYPE` | Sender or recipient type | Context-dependent |
| `CANCEL_REASON`, `DESCRIPTION` | Cancellation reason or refusal reason | Provided by canceler |
| `INTERVIEWER` | Interviewer name (if different from sender) | Interview assigned |
| `VENDOR_FULL_NAME`, `VENDOR_FIRST_NAME` | Freelancer/consultancy name | Vendor involved |
| `IS_BID` | Flag: interview is from a bid response | Bid-based interview |
| `LOCATION_TYPE` | Interview location type (search_address, etc.) | Interview created |
| `POKE_ID` | Direct interview invitation ID | Direct poke (not bid) |
| `CLIENT_FULL_NAME` | Client/hiring manager name | Admin notification |
| `JOB_REF` | Job/request reference | Admin notification |
| `COMMENT` | Interview feedback/comment | Admin notification |
| `NAME_INTERVIEWER` | Who created the interview | Admin notification |
| `MESSAGE` | Custom message (Archived email) | Archived email |
| `LINK`, `LINK_APPLICATION`, `LINK_VIEW_APPLICATION`, `LINK_VIEW_BID` | CTA link to platform | Email recipient determined |
