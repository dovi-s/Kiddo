# Founder Action Plan — the launch critical path

The deduplicated, ordered sequence of every NON-code item that gates launch,
synthesized from `LAUNCH_CHECKLIST.md`, `EXTERNAL_SERVICES.md`, `EMAIL_GOLIVE.md`,
`CUSTODIAN_VENDOR_DILIGENCE.md`, and `COUNSEL_ENGAGEMENT_PACKET.md`.

**The core finding (verified against code, 5 threads, 2026-06-12):** there is
essentially **zero net-new code on the launch critical path.** Both make-or-breaks
(capture-at-intent P0-1, custody P0-2) are **built-but-gated**. You are blocked on
**a lawyer engagement and a handful of provider/DNS setups**, not on engineering.

Order below = by *clock length*. The long-lead items decide your launch date, so
they go first even though the config items are faster.

---

## 🟥 START THIS WEEK — long-lead external clocks (weeks to months)

These two unblock the entire P0 surface. Nothing else matters until they're moving.

1. **Engage securities counsel — send `COUNSEL_ENGAGEMENT_PACKET.md`.**
   One engagement answers the questions that flip BOTH make-or-breaks:
   - *Can we hold / vault pre-fund gift money, and for how long?* → unblocks
     **P0-1** (then just flip `GIFTER_CAPTURE_AT_INTENT=true` — the code is built).
   - *The AUM / RIA structure memo* → unblocks **P0-2** (custody).
   - Plus the consolidated rest: COPPA, beneficiary/TOD, wind-down copy, and the
     **annual auto-renewal advance-notice** requirement (CA ARL / FTC click-to-cancel).
   This is the single highest-leverage move you can make. ~$3–5k, 2-week turnaround.

2. **Pick the custody provider** (`CUSTODIAN_VENDOR_DILIGENCE.md`):
   - Sign up for **Alpaca Broker API** sandbox → `npm run smoke:alpaca-custodial`
     (set `SMOKE_EMAIL_TO`/keys) to settle the 2 make-or-break questions
     (fractional-in-custodial + the at-18 handoff).
   - Get **DriveWealth** on a sales call in parallel (same question set).
   - Fill the scorecard → decide → set `CUSTODIAN_PROVIDER` and implement that one
     adapter (the interface + Alpaca client are already built).

3. **Public stranger photo/voice uploads — RECOMMENDED DEFAULT (2026-06-15): gate
   OFF at launch.** Draw the line at the *sender*, not the feature: ship money gifts,
   text notes (already safety-screened on all 5 paths), and **parent + invited-family
   media** ON; gate **public / untrusted-sender media OFF**. This deletes the only
   months-long clock from the critical path (the NCMEC + Microsoft PhotoDNA
   partnership) and closes the largest child-safety/CSAM surface (counsel packet
   Part 11), while keeping the Memory Book emotionally rich (its value is trusted-
   family media, not strangers). **Fully reversible:** turn public media on later once
   the real scanner is wired + the sender-trust pre-visibility gate is live. Only
   choose otherwise (and start the NCMEC/PhotoDNA clock NOW, months of lead time) if
   stranger-submitted media is core to the launch demo, which it isn't. **Founder:
   confirm this default.**

---

## 🟧 CONFIG / OPS — hours each, parallelize freely (no long lead)

4. **Stripe go-live:**
   - Swap to LIVE keys → `npm run founder:seed-stripe` (mints real products/prices).
   - Create a **LIVE webhook** → prod domain + `/api/stripe/webhook`, subscribed to
     the 9 handled events (checkout.session.completed, customer.subscription.updated/
     deleted, customer.deleted, payment_intent.succeeded/payment_failed,
     charge.refunded, invoice.paid/payment_failed). Set `STRIPE_WEBHOOK_SECRET` to
     THAT endpoint's secret (don't aim at an ephemeral dev host).
   - Dashboard settings: **statement descriptor = KIDDO/KIDDOFUND** (not a legal
     entity, not "Kora"), business name/icon/brand color = Kiddo, **customer emails:
     receipts ON / failed-payment+dunning OFF** (the app ships its own), support
     email = support@kiddofund.com.
   - Decide **Stripe Tax** (enable, or document why not — US SaaS subs are taxable
     in some states).

5. **Email go-live** (`EMAIL_GOLIVE.md`):
   - Postmark account → verify `kiddofund.com` → add **DKIM + SPF + DMARC** DNS.
   - Set `POSTMARK_SERVER_TOKEN` + `EMAIL_FROM` (a **monitored** inbox).
   - Wire the bounce webhook → `/api/webhooks/postmark`.
   - `npm run smoke:email` (set `SMOKE_EMAIL_TO`) → confirm it lands in the inbox.
   - **Then** flip `MAGIC_LINK_GIFTER_AUTH=true` (gated on email being live).

6. **Other prod env / secrets:**
   - Prod `SESSION_SECRET` (not the dev value), `SUPER_ADMIN_EMAILS`,
     `WEBAUTHN_RP_ID` + `WEBAUTHN_ORIGIN` = prod domain.
   - `CSRF_TRUSTED_ORIGINS` **if** the web app + API are on different hosts (else
     authed mutations 403 — the known deploy gotcha).
   - Supabase Storage keys (prod uploads), `SENTRY_DSN`, `POSTHOG_API_KEY`.
   - Optional, decide: Google/Apple OAuth keys (grandparent-friendly), market-data
     keys (Yahoo covers without them).

7. **Supabase:** re-run `npm run db:secure` **after any migration that adds a table**
   (new tables default to RLS-off).

---

## 🟩 VERIFY — after config, before opening the doors

- `npm run smoke:email` → real inbox delivery (not spam → DKIM/SPF/DMARC pass).
- `npm run smoke:alpaca-custodial` → custodial open + fractional buy (if Alpaca).
- Fresh prod signup → confirm it gets `trial_active` (reverse trial is on by default).
- Confirm `STRIPE_WEBHOOK_SECRET` is set and a test event verifies.

---

## The flag flips (the actual "go live" switches — after the gates above clear)

| Flag | Flip when | Unblocks |
|---|---|---|
| `GIFTER_CAPTURE_AT_INTENT=true` | counsel clears holding/vaulting gift money | P0-1 (capture-at-intent, already built) |
| `CUSTODIAN_PROVIDER=<chosen>` | provider picked + counsel AUM memo | P0-2 (custody, behind the interface) |
| `MAGIC_LINK_GIFTER_AUTH=true` | email is live + verified | passwordless gifter auth (no email = dark pattern) |
| reverse trial | already ON — just verify | "14 days free" pricing copy |

**Bottom line:** start the **counsel engagement** and the **custody-vendor + (if
needed) NCMEC** conversations this week. Everything else is hours of config you can
do whenever, and the code is already done.
