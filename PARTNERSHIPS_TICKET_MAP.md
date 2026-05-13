# Partnerships Ticket Map

Updated: 2026-04-12

Purpose:
- turn partnership strategy into execution work
- define what gets built before, during, and after each channel motion
- keep schools, employers, and advisers tied to product readiness

Use this alongside:
- `PARTNERSHIPS_FLYWHEEL.md`
- `PARTNERSHIPS_STAGE_GATES.md`
- `EXECUTION_BOARD.md`

---

## P0 - Foundational Partnership Readiness

### KORA-PARTNER-P0-001 - Partnership attribution model
- Owner: Backend + Growth
- Scope:
  - `server/routes.ts`
  - referral / analytics event ingestion
  - admin reporting endpoints
- Tasks:
  - add `channel_type`, `channel_name`, `campaign_id`, and `partner_id` to attribution payloads
  - support channels: `adviser`, `school`, `employer`, `brand`
  - persist attribution from landing visit through fund creation and first gift
- Acceptance:
  - new cohorts can be filtered by partnership channel
  - first gift and repeat gifting can be reported by channel

### KORA-PARTNER-P0-002 - Partnership landing page template
- Owner: Frontend + Growth
- Scope:
  - `client/src/pages/`
  - shared landing components
- Tasks:
  - create reusable partnership landing page shell
  - support partner headline, subheadline, CTA, trust strip, FAQ, and attribution parameters
  - keep mobile conversion optimized
- Acceptance:
  - a new partner page can be spun up without bespoke layout work
  - CTA and attribution wiring are standardized

### KORA-PARTNER-P0-003 - Admin cohort view for partnership channels
- Owner: Backend + Admin Frontend
- Scope:
  - `server/routes.ts`
  - `client/src/pages/Admin.tsx`
- Tasks:
  - add channel-level view for:
    - visits
    - signups
    - fund created
    - first gift
    - repeat gift
  - allow filtering by `partner_id`
- Acceptance:
  - admin can compare school vs employer vs adviser performance in one place

### KORA-PARTNER-P0-004 - Core partner one-pager and demo script
- Owner: Product + Growth
- Scope:
  - repo docs only
- Tasks:
  - write one partnership one-pager
  - write one 5-minute live demo script
  - standardize answers on:
    - what Kora is
    - why custodial investing matters
    - what makes Kora different from checks and gift cards
- Acceptance:
  - team uses one consistent narrative in external conversations

---

## P1 - DriveWealth / Adviser Intros

### KORA-PARTNER-P1-001 - Adviser intro pipeline and CRM doc
- Owner: Growth
- Scope:
  - repo docs only
- Tasks:
  - define target adviser profile
  - define outreach sequence
  - define intro, meeting, follow-up, and referral statuses
- Acceptance:
  - adviser intros move through one visible pipeline

### KORA-PARTNER-P1-002 - Adviser-ready trust and compliance page
- Owner: Frontend + Product
- Scope:
  - `client/src/pages/FAQ.tsx`
  - `client/src/pages/Legal.tsx`
  - trust content surfaces
- Tasks:
  - tighten explanation of:
    - Kora vs DriveWealth roles
    - UTMA ownership and handoff
    - investment custody and legal structure
  - make the page legible to both parents and advisers
- Acceptance:
  - adviser conversations no longer depend on verbal clarification alone

### KORA-PARTNER-P1-003 - Adviser referral handoff flow
- Owner: Frontend + Backend
- Scope:
  - landing page attribution
  - signup flow
  - admin reporting
- Tasks:
  - support referred signup path from adviser links
  - tag referred accounts and first gifts
  - confirm referral attribution survives onboarding
- Acceptance:
  - adviser-sourced parents can be tracked through first gift

---

## P1 - Schools Pilot

### KORA-PARTNER-P1-004 - School pilot package
- Owner: Growth + Product
- Scope:
  - repo docs only
- Tasks:
  - define pilot format:
    - pilot goal
    - pilot duration
    - school champion role
    - family call to action
  - include one email template and one flyer copy block
- Acceptance:
  - school outreach uses one repeatable pilot package

### KORA-PARTNER-P1-005 - School-specific landing flow
- Owner: Frontend
- Scope:
  - partnership landing template
  - signup CTA wiring
- Tasks:
  - support school logo/name/slug
  - add copy tuned for parent trust and school community language
  - include a simple "how it works for our families" section
- Acceptance:
  - each school pilot can have a dedicated parent-facing page

### KORA-PARTNER-P1-006 - School pilot cohort reporting
- Owner: Backend + Admin Frontend
- Scope:
  - admin dashboards
  - reporting endpoints
- Tasks:
  - add school pilot metrics:
    - families reached
    - signups
    - funds created
    - first gifts
    - average gifts per fund
  - add pilot notes field for qualitative observations
- Acceptance:
  - school pilot can be judged on both conversion and trust signal

### KORA-PARTNER-P1-007 - School referral kit inside product
- Owner: Frontend
- Scope:
  - host share surfaces
  - event and dashboard surfaces
- Tasks:
  - add copy variant for school-distributed families
  - generate school-safe share text for parents
- Acceptance:
  - parents from school pilots get a clearer first-share path

---

## P2 - Employer Benefits

### KORA-PARTNER-P2-001 - Employer benefits narrative and packaging
- Owner: Product + Growth
- Scope:
  - repo docs only
- Tasks:
  - define employer story:
    - family financial wellness
    - milestone gifting
    - investing for children
  - define what Kora is and is not as a benefit
- Acceptance:
  - employer outreach uses one coherent package, not generic B2B language

### KORA-PARTNER-P2-002 - Employer cohort landing and invite flow
- Owner: Frontend + Backend
- Scope:
  - partnership landing template
  - attribution model
  - onboarding entry points
- Tasks:
  - support employer-branded landing pages
  - support employee cohort codes or invite params
  - preserve attribution through signup and fund creation
- Acceptance:
  - employer-origin cohorts are fully measurable

### KORA-PARTNER-P2-003 - Employer-ready admin scorecard
- Owner: Backend + Admin Frontend
- Scope:
  - `client/src/pages/Admin.tsx`
  - reporting endpoints
- Tasks:
  - create employer scorecard:
    - signups
    - funds created
    - first gifts
    - repeat gifts
    - cost per activated fund
- Acceptance:
  - the team can judge whether employer acquisition beats paid acquisition economics

### KORA-PARTNER-P2-004 - Onboarding copy variant for employer cohorts
- Owner: Frontend + Growth
- Scope:
  - `client/src/pages/GetStarted.tsx`
  - landing-to-signup handoff copy
- Tasks:
  - create employer-specific onboarding framing
  - explain Kora in benefit-style language without making it sound corporate
- Acceptance:
  - employer-origin users see a cleaner narrative fit from landing to signup

---

## P3 - Brand Partnerships

### KORA-PARTNER-P3-001 - Brand partnership brief template
- Owner: Growth
- Scope:
  - repo docs only
- Tasks:
  - define brief template:
    - audience
    - offer
    - landing page
    - CTA
    - success metric
- Acceptance:
  - no brand campaign launches without a written brief

### KORA-PARTNER-P3-002 - Brand campaign landing variants
- Owner: Frontend
- Scope:
  - partnership landing template
- Tasks:
  - add campaign blocks for:
    - creator quote
    - limited-time offer
    - partner explainer
  - preserve conversion cleanliness
- Acceptance:
  - brand pages can be customized without becoming cluttered

### KORA-PARTNER-P3-003 - Brand channel quality reporting
- Owner: Backend + Admin Frontend
- Scope:
  - channel reporting
  - admin dashboards
- Tasks:
  - report:
    - visit to signup
    - signup to fund create
    - fund create to first gift
    - repeat gifting quality
  - distinguish reach from qualified traffic
- Acceptance:
  - the team can tell whether a brand drove real distribution or vanity attention

---

## Suggested Rollout Order

### Now
- P0 foundational readiness
- one adviser intro motion

### Next
- 1 to 3 school pilots
- employer packaging prep, but not broad outreach

### Later
- one employer design partner
- brand tests only after employer and school data prove the conversion path

## Definition Of Done

For any partnership ticket to count as done:

1. channel attribution is measurable
2. the landing and onboarding path work on mobile
3. admin can see downstream outcomes, not just clicks
4. the work improves a repeatable channel, not a one-off exception
