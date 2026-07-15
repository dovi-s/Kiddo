# Push + PWA Go-Live Runbook

Get **Web Push notifications** and the **installable PWA** live in production. Do
these in order; the whole thing is ~15 minutes plus a device test. Nothing here
needs new code — the feature is built and verified (see memory
`project_push_notifications_plumbing.md`).

## 0. Prereqs
- Prod hosting reachable over **HTTPS** (PWA + push require a secure context;
  Render gives you this by default).
- DB access for migrations (the same `DATABASE_URL` the app uses).

## 1. Generate PROD VAPID keys (never in a shared terminal/log)
The dev keys were exposed in a chat transcript, so prod needs fresh ones.
```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```
Set in Render (or your host) as **secrets**, never committed:
- `VAPID_PUBLIC_KEY` = the printed publicKey
- `VAPID_PRIVATE_KEY` = the printed privateKey
- `VAPID_SUBJECT` = `mailto:support@kiddofund.com` (or your contact)

⚠️ Set these **once, before anyone subscribes.** Rotating VAPID keys after users
subscribe invalidates every existing subscription and forces a re-subscribe.

## 2. Migrate the database
The migration is already written + journal-registered: `migrations/0050_push_subscriptions.sql`
(idempotent — `CREATE TABLE IF NOT EXISTS`). Prod doesn't have the table yet.
```bash
npm run db:migrate   # applies 0050 → creates push_subscriptions
npm run db:secure    # REQUIRED: new Supabase tables default to RLS-off
```
This project **hand-writes SQL migrations + `db:migrate`** — do NOT use `db:push` /
`db:generate` (broken here: stale snapshot recreates the whole schema). `db:secure`
is not optional: `push_subscriptions` holds device endpoints + crypto keys and must
not be world-readable. (Verified: `db:migrate` applies 0050 clean against a synced DB.)

## 3. Deploy
Deploy the app. On boot, confirm push is configured:
```bash
curl https://<your-domain>/api/push/public-key
# expect: {"publicKey":"B...","enabled":true}
```
`enabled:true` means the VAPID env is loaded. If `enabled:false`, the keys aren't
set in the environment — recheck step 1.

## 4. Verify on a real device (the one thing headless can't test)
1. On your phone, open the site in Safari/Chrome → **Add to Home Screen** →
   launch from the icon (full-screen standalone = PWA working).
2. In the app: **Settings → Notifications → toggle "Push notifications" on** →
   grant the browser prompt.
3. Tap **"Send a test notification"** → a notification should arrive, even with
   the app backgrounded. Tapping it should open the app.
   - If nothing arrives: check the browser didn't block notifications; confirm
     step 3's `enabled:true`; check server logs for `[push] send failed`.

## 5. Turn on the gift-landing buzz (payments chat)
The highest-value push fires when a gift payment clears — that's in the payments
handler, not this feature. Hand `_TANDEM_gift_landing_push_HANDOFF.md` to that
chat; it's a one-line `sendPushToUser` add against infra that's already live.

## Notes / rollback
- Push is **fail-safe**: with no VAPID env it silently no-ops, so a missing key
  never breaks anything else — it just means no pushes.
- To pause all pushes: unset `VAPID_PRIVATE_KEY` (server reports `enabled:false`,
  every send becomes a no-op). No deploy of code needed.
- What buzzes is the allowlist `PUSH_WORTHY_ACTIVITY_TYPES` in `server/storage.ts`;
  edit that Set to add/remove moments. Deep-link targets are `PUSH_URL_BY_TYPE`
  right below it.
