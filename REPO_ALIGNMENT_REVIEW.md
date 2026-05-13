# Repo Alignment Review

Updated: 2026-04-03

This document reviews the support, compliance, and launch draft against the current repo.

Use these buckets:
- `safe_to_publish`: consistent with the current repo and product-safe to say publicly
- `needs_legal_softening`: directionally right, but wording is too absolute, too jurisdiction-specific, or too operationally strong
- `does_not_match_current_implementation`: not how this repo is built today, or not something we should claim is live

## Safe To Publish

### Support / FAQ
- "Is my child's money safe?" framed around DriveWealth custody and SIPC
- Gift code exists and resolves to the same private gift page
- Fund sharing includes shareable links and QR code flows
- Gifter milestone opt-in exists
- Memory Book share flows exist
- Personal funds are supported in repo/product language
- Tax documents should be framed as brokerage-side reporting, not Kado tax advice

### Operational boundaries
- Stripe is the payment processor
- DriveWealth is the custody/brokerage partner named in legal copy
- Session auth plus optional Google/Apple OAuth matches this repo
- One transactional email provider plus fallback outbox matches this repo
- Custodian transfer is an external webhook boundary, not an invisible internal automation

### Product and launch framing
- Legal/custody are the real critical path
- Privacy Policy must be updated whenever a planned processor becomes active
- Large gifts and suspicious activity need explicit review/ops handling

## Needs Legal Softening

### FAQ copy
- "If Kado ceased to exist tomorrow, your child's investments would remain safe and accessible through DriveWealth directly."
  Safer: the assets are not Kado's, remain in the custodial/brokerage structure, and any continuity/offboarding path follows the brokerage and custody process.
- "What happens when my child turns 18?"
  Safer: say "age of majority, usually 18 or 21 depending on state" instead of making 18 universal.
- "The fund legally becomes theirs. The investments stay exactly where they are. Nothing is sold."
  Safer: the investments do not need to be sold solely because the child reaches the transfer milestone; actual control/transfer handling depends on account structure, custody workflow, and state law.
- "You will receive a 1099 from DriveWealth."
  Safer: if the account generates taxable activity, the brokerage side of the experience provides the relevant tax documents.

### Compliance checklist language
- Any statement implying Kado has already completed counsel review, COPPA review, AML implementation, or books-and-records implementation should remain checklist language, not marketing or public-facing copy.
- GDPR language should not imply Kado is actively serving EU users unless product/legal scope really supports it.
- State-specific age-of-majority rules should not imply the app fully automates those rules unless the implementation is actually complete.

### Support operations language
- Response-time promises like "under 4 hours" or "under 24 hours" should not be published unless there is staffing and tooling to support them.
- "Escalate to securities attorney within 4 hours" is a good internal policy target, but not a public promise.

## Does Not Match Current Implementation

### Authentication / infrastructure
- "Set up Clerk authentication"
  The repo does not use Clerk. It uses Passport/session auth with optional Google and Apple OAuth.
- "Set up Cloudflare DNS and CDN"
  Not represented as a runtime dependency in this repo.
- "Set up Vercel for frontend hosting"
  Possible deployment choice, but not a required or coded dependency.

### Support tooling
- "Tier 1: Intercom automated responses"
  Intercom is planned, not wired.
- "Tier 2: Intercom live chat"
  Intercom is planned, not wired.
- "Statuspage live"
  Statuspage is not wired or referenced as an active system in repo runtime.

### Analytics / growth tooling
- "Mixpanel tracking all events"
  Mixpanel is planned, not wired.
- "Google Analytics 4 and Search Console" as already-implemented runtime requirements
  GA4 is planned, not wired in repo.
- "Microsoft Clarity"
  Mentioned as a launch recommendation, not wired in code.
- "Klaviyo with behavioral triggers"
  Planned, not wired.
- "Firebase Cloud Messaging"
  Planned, not wired.

### Payments / banking
- "Stripe with Apple Pay, Google Pay, ACH" as fully confirmed live
  Stripe is wired; specific payment method readiness should be stated only after dashboard/payment-method configuration is complete.
- "Plaid" as an active launch dependency
  Plaid is planned, not wired.

### Product claims that need implementation checks
- "Gifters can choose a different stock" as a universal statement
  In repo, this depends on fund settings. Parents can allow or disallow gifter stock override and cash gifts.
- "Emma receives a personal invitation to create her own Kado account, sees her Memory Book, and takes full ownership of the fund" as a guaranteed live flow
  Age-transition flows exist in repo, but public wording should not overstate completion without final custody/legal confirmation.
- "All 9 triggers live"
  Repo has monetization and lifecycle trigger concepts, but a public/internal launch checklist should not claim every trigger is already fully productionized unless verified.

## Recommended Rewrites

### Safer shutdown FAQ
> Your child's investments are not Kado's assets. They are held through the custody and brokerage structure with DriveWealth, LLC. If Kado ever shut down, the investments would not disappear with the company, and any continuity or transfer process would follow the applicable brokerage and custody process.

### Safer stock-choice FAQ
> Every fund has a family default. Gifters follow that default unless the parent has enabled stock-choice or cash overrides in fund settings.

### Safer age-of-majority FAQ
> When your child reaches the age of majority for your state, the UTMA legally becomes theirs. In many states that is 18 or 21. The investments do not need to be sold solely because that milestone is reached; what changes is who legally controls the account.

### Safer tax-doc FAQ
> If the account generates taxable activity, the brokerage side of the experience provides the relevant year-end tax documents. Kado does not provide tax advice, so families should work with a qualified tax professional for filing questions.

## Recommended Internal Corrections

- Replace every Clerk reference with session auth plus optional Google/Apple OAuth.
- Treat Intercom, Mixpanel, GA4, Klaviyo, Firebase, Twilio, Statuspage, and Plaid as `planned`, not launch-fact language.
- Keep DriveWealth copy strong on custody, but avoid overpromising exact continuity mechanics unless legal/custody ops have confirmed them.
- Keep age-18 copy aligned to state-dependent age of majority.
