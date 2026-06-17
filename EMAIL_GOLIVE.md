# Email go-live runbook

**Status:** the email *code* is DONE and high-quality (35+ templates, ~25 lifecycle
workers, suppression + dedupe + bereavement freeze + one-click unsubscribe, a
Postmark AND a SendGrid transport in `server/emailDelivery.ts`). The only thing
missing is **provider configuration + domain authentication** — a founder/DNS
task, not code. This is the single biggest launch-critical gap (it blocks
transactional mail, the recurring-gift loop, and magic-link gifter auth).

Until a provider token is set, every email silently queues to
`.local/email-outbox.jsonl` (fine for dev, sends nothing).

## One-command verification

After each step below, prove it:

```
set NODE_OPTIONS=--use-system-ca&& set SMOKE_EMAIL_TO=you@yourinbox.com&& npm run smoke:email
```

It renders a real template and pushes it through the actual `sendEmail()` path,
then prints `mode=postmark|sendgrid|outbox_fallback`. `postmark`/`sendgrid` with
`delivered=true` = live. `outbox_fallback` = no provider (or the send errored;
check `.local/email-outbox.jsonl`).

## Steps (Postmark — recommended; it is transactional-first and what the code defaults to)

1. **Create a Postmark account** + a Server. Grab the **Server API Token**.
2. **Add and verify the sending domain** (`kiddofund.com`, matching the default
   `EMAIL_FROM`). Postmark gives you DNS records:
   - **DKIM** (a TXT/CNAME record) — required.
   - **Return-Path / custom bounce** (a CNAME) — recommended.
3. **Add DNS records at your registrar:**
   - **SPF:** `v=spf1 include:spf.mtasts.net ~all` style record per Postmark's
     instructions (or add Postmark to your existing SPF; do NOT create a second
     SPF record).
   - **DKIM:** the record Postmark generates in step 2.
   - **DMARC:** start at `v=DMARC1; p=none; rua=mailto:dmarc@kiddofund.com` (monitor),
     tighten to `p=quarantine` then `p=reject` once DKIM/SPF pass cleanly.
   - Gmail + Yahoo REQUIRE SPF + DKIM + DMARC for bulk senders. Do not skip DMARC.
4. **Set environment variables** (prod + any staging that should send):
   - `POSTMARK_SERVER_TOKEN=<token>`  (this is the on/off switch — set it and mail sends)
   - `EMAIL_FROM=support@kiddofund.com`  (or your verified from-address; default is this)
   - `POSTMARK_MESSAGE_STREAM=outbound`  (default; only change for a separate stream)
   - optional `SUPPORT_EMAIL=...` (fallback from-address if `EMAIL_FROM` unset)
5. **Configure the Postmark webhook** for bounces + spam complaints, pointing to:
   - `POST https://<your-app-host>/api/webhooks/postmark`
   - This feeds `server/postmarkWebhook.ts`, which auto-suppresses hard-bounced
     and complained addresses (protects sender reputation). Without it, repeated
     bounces will degrade deliverability.
6. **Verify:** run the smoke command above to your own inbox. Confirm it arrives
   (check spam). If it lands in spam, your SPF/DKIM/DMARC are not fully passing —
   fix step 3 before launch.
7. **Then, and only then, flip the magic-link flag:** `MAGIC_LINK_GIFTER_AUTH=true`.
   This is deliberately gated on email being LIVE: passwordless gifter auth with
   no delivered email = no cancel path = a dark pattern (see
   `project_recurring_engine_decision`). The code already no-ops the magic-link
   routes while the flag is off, so it is safe to leave off until step 6 passes.

## SendGrid alternative

The code supports it too: set `SENDGRID_API_KEY` instead of the Postmark token
(everything else — `EMAIL_FROM`, templates, suppression — is identical). Postmark
is the recommendation for transactional deliverability + the simpler webhook.

## What does NOT need doing

- No template work (all built + on-brand; the verification email sets the calm
  register every other email follows).
- No transport code (Postmark + SendGrid both fully implemented).
- The demo (`riverafamily.com`) and `example.*` are hard-blocked from real
  delivery even with a provider set (`NEVER_DELIVER_DOMAINS`), so demo workers
  can't leak bearer-token links to a domain we don't own.

## Reminder

Domain reputation builds over time. Send real volume gradually after go-live;
don't blast the whole lifecycle backlog on day one.
