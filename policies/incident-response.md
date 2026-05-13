# Incident Response Policy

**Owner:** Founder (incident commander by default)
**Last reviewed:** 2026-05-10
**Review cadence:** annual; tabletop exercise annual

## 1. Purpose

Defines how Kiddo detects, responds to, contains, communicates,
remediates, and learns from security incidents.

## 2. Scope

A "security incident" is any of:

- Unauthorized access to customer data, even if read-only
- Loss or unintended disclosure of customer data
- Compromise of credentials, secrets, or signing keys (Stripe webhook,
  Supabase admin, GitHub, domain registrar, email)
- Unintended money movement through the Stripe or DriveWealth (when
  wired) integration
- Unintended public exposure of a memory entry tagged kid-only or
  parent-only
- Suspected CSAM or child-safety violation in uploaded content (also
  invokes the NCMEC reporting obligation)
- Site-wide outage exceeding 30 minutes during business hours
- Successful phishing of any account in the access matrix
- Discovery of a vulnerability with known active exploitation against
  Kiddo

Routine bugs that don't reach data confidentiality, integrity, or
availability thresholds are not incidents. Use the bug tracker.

## 3. Severity classification

| Severity | Examples | Initial response | Communication |
|---|---|---|---|
| **SEV-1** | Confirmed data breach; active fraud; unintended money movement; site fully down >30 min during business hours | Within 30 min, founder paged | Customers within 72 hours per applicable law; affected regulators per timeline (e.g., DriveWealth notification) |
| **SEV-2** | Suspected breach (not yet confirmed); credential compromise without confirmed data access; partial outage; Tier 2 data exposure | Within 2 hours | Customers within 5 business days if confirmed |
| **SEV-3** | Known vulnerability without active exploitation; misconfiguration corrected before exposure; near-miss | Within 1 business day | Internal only unless escalated |

## 4. Response phases

### 4.1 Detect

- Sentry alerts (when DSN is configured)
- Stripe webhook delivery failures or unexpected refunds
- Supabase health alerts
- Customer reports to security@kiddofund.com or support@kiddofund.com
- Audit log review (manual today; automated alerting on roadmap)
- Pager from the founder's own monitoring

### 4.2 Triage

The first responder (today: founder):

1. Confirms the incident is real (not a false positive). Documents
   what was observed.
2. Assigns severity per §3.
3. Opens an incident file at `incidents/YYYY-MM-DD-shortname.md`
   using `incidents/TEMPLATE.md`.
4. Becomes incident commander or hands off explicitly.

### 4.3 Contain

The incident commander:

1. Isolates the affected system (rotate the compromised credential,
   block the malicious IP, take the surface offline if needed).
2. Preserves evidence — do not delete logs, sessions, or data while
   investigating. Take snapshots before remediation if uncertainty
   exists.
3. Assesses blast radius — what data was touched, by whom, for how
   long, with what access.

### 4.4 Eradicate

1. Remove the threat (kill the session, revoke the key, ban the
   account, deploy the patch).
2. Verify the threat is gone via logs, retesting, and direct
   inspection.

### 4.5 Recover

1. Restore service with safeguards in place (tighter rate limits,
   added monitoring, additional auth layer if applicable).
2. Confirm normal operation via a full smoke test of the affected
   surfaces.
3. Update status page / customer communication channel as
   appropriate to the severity.

### 4.6 Lessons learned

Within 5 business days of resolution:

1. Complete the root-cause analysis section of the incident file.
   "Why did this happen?" → "Why did that happen?" five times
   minimum until you reach a structural answer.
2. Document follow-up actions with owners and due dates.
3. Update the relevant policies, runbooks, or controls to prevent
   recurrence.
4. If the lesson is durable, capture it in the locked memory
   (`C:\Users\dovis\.claude\projects\C--Apps-Kora--newest-\memory\`)
   so future sessions inherit it.

## 5. Communication

### Internal

- The founder is always notified of any SEV-1 or SEV-2.
- (When team grows) Slack #incidents channel; engineering is paged
  for SEV-1 within 30 minutes.

### External — customers

- SEV-1 confirmed breach: notify all affected customers within 72
  hours of confirmation, by email. Include: what happened, what data
  was affected, what we've done, what they should do, contact for
  questions.
- SEV-2 confirmed: notify affected customers within 5 business days
  if confirmed.
- The first sentence of every customer-facing breach communication
  follows the locked-memory pattern: "[Child]'s fund is safe.
  [Detail follows]." See
  `feedback_emmas_fund_is_safe_error_pattern.md`.
- Do not wait until full root-cause is complete. Communicate what is
  known, mark what is still being investigated, follow up.

### External — regulators

- DriveWealth (when wired): per their SLA in the partner agreement.
- NCMEC: required for any confirmed CSAM finding. Within the
  statutory window (typically immediately to as soon as reasonably
  possible).
- State AGs: per applicable state breach notification law (CA, NY,
  others have specific timing).
- SEC / FINRA: via DriveWealth's reporting framework.

### External — public

- A status page or notice on the Kiddo site for SEV-1 outages or
  confirmed breaches affecting all users.
- Social media communication is by the founder only.
- Do not respond to media inquiries until the incident is contained
  and a written statement is approved by the founder.

## 6. Tabletop exercises

- One per year minimum. First one scheduled Q4 2026 (see SECURITY.md
  §6 open items).
- Pick a plausible scenario (e.g., Stripe webhook secret leaked).
  Walk through detect → triage → contain → eradicate → recover →
  lessons learned. Document the exercise in
  `incidents/tabletops/YYYY-MM-DD-scenario.md`.

## 7. Evidence retention

- Incident files in `incidents/` are kept for 7 years minimum.
- Logs, audit_logs entries, webhook_events relevant to the incident
  are exported and stored alongside the incident file.

## 8. References

- `incidents/TEMPLATE.md` — template for new incident files
- `policies/access-control.md` — emergency access procedures
- `SECURITY.md` — public-facing security posture
- `project_child_safety_architecture.md` (locked memory) — child
  safety incident escalation specifics
