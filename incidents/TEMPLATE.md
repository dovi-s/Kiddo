# Incident: [SHORT TITLE]

**Date detected:** YYYY-MM-DD HH:MM TZ
**Date resolved:** YYYY-MM-DD HH:MM TZ
**Severity:** SEV-1 / SEV-2 / SEV-3
**Incident commander:** [name]
**Status:** [open | contained | resolved | post-mortem complete]

> Copy this file to `incidents/YYYY-MM-DD-shortname.md` and fill it in
> as the incident progresses. Sections marked "fill in real time" are
> updated during the incident; sections marked "post-mortem" are
> completed within 5 business days after resolution per
> `policies/incident-response.md` §4.6.

---

## Summary (one paragraph)

What happened, in three sentences. Plain language. The first sentence
follows the locked-memory pattern when this affects user data:
"[Child]'s fund is safe. [What happened.] [What we've done.]"

---

## Detection (fill in real time)

- **How detected:** [Sentry alert | customer report | internal monitoring | audit log review | other]
- **First indicator:** [the specific signal that triggered the response]
- **Time from indicator to triage:** [duration]

---

## Triage (fill in real time)

- **Confirmed real (not false positive):** YES / NO
- **Severity assigned:** SEV-1 / SEV-2 / SEV-3
- **Severity rationale:** [one sentence]
- **Initial blast radius assessment:**
  - Data potentially affected: [Tier 1 / Tier 2 / Tier 3 — name the columns]
  - Users potentially affected: [count or "unknown"]
  - Time window of exposure: [from X to Y, or "still active"]

---

## Containment (fill in real time)

What was done to stop the bleeding. Include exact times.

- HH:MM — [action taken]
- HH:MM — [action taken]
- HH:MM — [action taken]

---

## Eradication (fill in real time)

How the threat was removed.

- [step]
- [step]

Verification that the threat is gone:
- [evidence]

---

## Recovery (fill in real time)

How service was restored.

- [step]
- [step]

Smoke test results:
- [what was tested, what passed]

---

## Communication (fill in real time)

Customers:
- **Notified:** YES / NO / N/A
- **When:** [date / time]
- **Channel:** [email / status page / in-app banner]
- **Message:** [link to or paste the actual message sent]

Regulators / partners:
- DriveWealth: [N/A | notified per SLA at HH:MM]
- NCMEC: [N/A | reported at HH:MM]
- State AGs: [N/A | which states, when]
- SEC / FINRA via DriveWealth: [N/A | filed]

Public:
- Status page: [N/A | updated at HH:MM]
- Social: [N/A | post link]
- Media: [N/A | inquiry from X, response sent at HH:MM]

---

## Root cause analysis (post-mortem)

**Five whys (minimum):**

1. Why did this happen? [answer]
2. Why did THAT happen? [answer]
3. Why did THAT happen? [answer]
4. Why did THAT happen? [answer]
5. Why did THAT happen? [answer]

**Structural answer:** [the load-bearing one-sentence explanation]

---

## Timeline (post-mortem)

Compiled from real-time notes above plus log review.

| Time | Event |
|---|---|
| HH:MM | [event] |
| HH:MM | [event] |
| HH:MM | [event] |

---

## What went well (post-mortem)

- [thing]
- [thing]

## What went poorly (post-mortem)

- [thing]
- [thing]

## What we got lucky with (post-mortem)

> The point of this section is to surface latent risks that didn't
> bite us this time but could have. Be honest.

- [thing]
- [thing]

---

## Follow-up actions (post-mortem)

| # | Action | Owner | Due | Status |
|---|---|---|---|---|
| 1 | [action] | [name] | YYYY-MM-DD | open |
| 2 | [action] | [name] | YYYY-MM-DD | open |

---

## Locked-memory updates (post-mortem)

If a durable principle came out of this incident, capture it as a
memory file in
`C:\Users\dovis\.claude\projects\C--Apps-Kora--newest-\memory\` and
list it here:

- [memory file name + one-line description, or "none"]

---

## Evidence retained

- Audit logs from [start time] to [end time]: [path or attachment]
- Webhook event records: [path]
- Sentry events: [link or export]
- Customer communication: [path]
- Other: [path]

Retention: 7 years per `policies/incident-response.md` §7.

---

## Sign-off

- Incident commander: [name] — [date]
- Founder: [name] — [date]
- (When applicable) Security/compliance owner: [name] — [date]
