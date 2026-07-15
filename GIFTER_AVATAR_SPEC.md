# Gifter Profile Photos — Spec (PARTIALLY BUILT — see status)

**Status (updated 2026-06-05, same day):** a parallel session built the
parent-facing core of this spec before this writeup was discovered (founder
approved both). Reconciled state:

- **BUILT + runtime-verified (chromium, demo as Jay):** the §4 upload block on
  `/gifter` (avatar on the hero, add/change/remove, initials fallback,
  gifter-only self-write via `PATCH /api/user/profile`, removal contract
  `profileImageUrl: ""` → null); the §3 data model exactly as specced
  (users record + `gifts.senderEmail → users` enrichment — the server already
  emits `gifterAvatarUrl` on gift rows); consent caption in the avatar menu
  ("Families see this photo beside your gifts."); rendering on the
  parent-facing surfaces — Dashboard roster, gift history, `FundSnapshot.tsx`.
- **§6.1 moderation: WIRED (same day).** Profile-photo uploads now run through
  `server/contentScanner.ts` — the same scanner as gift media, same
  silent-log-and-refuse on a hit (audit + ops alert + generic error), and the
  same fail-closed-in-prod default. **Profile photos are effectively OFF in
  production until a real scanner vendor is configured** — which IS the gate
  behaving as designed.
- **STILL PARKED (the remaining gate):** §6.2 per-fund parent hide/report
  override + its table, the shared `<GifterAvatar>` refactor, and — hard rule —
  **Kid View must NOT render gifter photos until §6.2 ships** (verified
  2026-06-05: it doesn't today; no child-facing surface consumes
  `gifterAvatarUrl`).

Original parked framing below, kept for the un-park work breakdown.

**One-liner:** let a *logged-in gifter* add/edit/remove their own profile photo
from "My Gifts"; it then replaces their initials-circle wherever their avatar
appears (the "Who loves {kid}" roster, Kid View, gift history, snapshot). Remove
it → falls straight back to the initials/color/circle. **A parent or kid can
NEVER set or change another gifter's photo.**

---

## 1. Why (and why it's right, not just cute)

The thesis is **the gifter is the customer**. A face instead of "JP" treats them
as a first-class user, and the emotional payoff is real: a kid opening Kid View
and seeing **Grandpa's actual face** beats "JP" by a mile. It's a tiny identity
investment that deepens gifter attachment to the platform.

**Nice side-effect (founder's catch):** account-less gifters keep the initials
(no account → no photo). So the *engaged* gifters — relatives, super-gifters —
get faces, while one-off anonymous givers stay clean. **The feature naturally
rewards the people who matter most to the loop.**

---

## 2. Design principles (LOCKED by founder)

1. **Purely additive.** The initials/colors/circles system stays *exactly* as
   is — it's the universal fallback. Nothing about it changes. A photo is just an
   override *on top of* it.
2. **Gifter-only authorship.** Only the gifter sets/edits/removes their *own*
   photo, from their own logged-in "My Gifts" surface. Parents/kids can never set
   one for someone else. (They CAN hide one on their own fund — §6.)
3. **Remove → initials.** Deleting the photo reverts to the existing initials
   treatment everywhere, instantly.
4. **One identity, everywhere.** A gifter's photo follows *them* across every
   fund they've gifted to (consistent identity), resolved by their account.

---

## 3. Data model

- **The photo lives on the gifter's USER record**, not on the gift. (The parent
  already has a profile photo via the Account page, so the users table already
  has a photo column — reuse it; don't add a parallel "gifter photo" field.)
  - If the existing user photo column is *also* the in-app profile photo the
    parent uses, that's fine — a user's profile photo IS their gifter avatar.
    Same person, same face.
- **Join key: `gifts.senderEmail` → `users.email` → `users.photoUrl`.** Every
  gift carries `senderEmail`; that's how an avatar surface resolves a gifter's
  photo. No new linkage needed.
- **NOTE the trap:** `gifts.photoUrl` already exists but is **gift media** (a
  photo attached *to the gift*), NOT the avatar. Do not conflate them. The avatar
  comes from the *user* record.
- **New: a per-fund parent-hide flag** (§6) — e.g. a small
  `gifter_photo_hidden (fundId, gifterEmail, hiddenAt, reason)` table, so a
  parent can suppress a specific gifter's photo on *their* kid's fund.

---

## 4. Upload flow (in "My Gifts")

- On `/gifter` (the gifter dashboard), add a profile block: the gifter's current
  avatar (photo or initials) + "Add photo" / "Change" / "Remove."
- **Reuse the existing Account-page photo upload** (component + endpoint) — same
  crop/size/validation (image-only, <5MB, square crop). Don't reinvent it.
- On save → moderation (§6) → set `users.photoUrl` → invalidate the avatar
  caches so it propagates.
- Remove → null the column → initials everywhere.

---

## 5. Avatar resolution (the cross-cutting part)

Every surface that renders a gifter avatar resolves photo-or-initials:

- **Server:** wherever a gifter roster / gift list is built, join `senderEmail →
  users.photoUrl` and include a `gifterPhotoUrl: string | null` per gifter. Apply
  the per-fund hide flag (§6): if hidden on this fund, return null.
- **Client:** a single shared `<GifterAvatar photoUrl initials color size />`
  component — `photoUrl ? <img> : <existing initials circle>`. **Refactor the
  current initials-circle markup into this one component** so every surface uses
  it and the fallback stays pixel-identical.

**Surfaces to wire (audit before building):**
- Dashboard "Who loves {kid}" roster
- **Kid View** "who loves you" (the most sensitive — see §6)
- Gift history (dashboard, gifter dashboard, `FundSnapshot.tsx`)
- Memory Book gift moments / notification rows (anywhere an initials circle shows)
- The gifter's own "My Gifts" header

---

## 6. 🔴 Child safety — the gating requirement (BUILD THIS FIRST)

A gifter's photo appears **in a child's view** (Kid View) and the parent's. That
is an **adult-uploaded image shown to a minor** — a different risk class than a
parent's own pic shown to themselves, and it ties directly to the COPPA / legal
posture in `COUNSEL_ENGAGEMENT_PACKET.md`. Two non-negotiables:

1. **Image moderation on upload.** Auto-scan every gifter photo (a moderation
   API / vision service); reject flagged content (nudity, violence, etc.);
   hold-for-review on uncertainty. A photo never reaches a child unmoderated.
2. **Parent override (per fund).** The parent can **hide / report** a specific
   gifter's photo on *their* kid's fund → falls back to initials for that fund,
   and flags it for admin review. The family is the last line of defense; the
   gifters are *usually* known relatives, but "usually" is not a safety policy.

**Optional stricter mode (offer as a fund setting):** "require my approval before
a gifter's photo shows" — for parents who want opt-in rather than
moderate-then-hide. Default = auto-moderate + parent-can-hide (low friction);
strict = parent-approval (higher friction, max control).

**Do not ship the photo feature without #1 and #2.**

---

## 7. Privacy + edge cases

- **Gifter-only authorship** (§2) — enforce server-side: a photo write must be
  the authenticated gifter writing their *own* user record. No endpoint lets A
  set B's photo.
- **The photo is shown to every family the gifter gifted to.** A gifter who gives
  to two unrelated families shows the same face to both. That's consented (it's
  their profile photo) — but state it in the upload copy ("This shows to the
  families you've gifted to").
- **A parent who gifts to *another* family's kid** is a gifter there — their own
  profile photo is their avatar there. Consistent, correct.
- **Account-less / anonymous gifters** → no user record → initials (unchanged).
- **Right to be forgotten / deletion:** removing the photo + account deletion
  must purge it from storage (data-deletion posture).
- **Demo accounts can't set/edit a photo.** When the upload endpoint is built,
  add it to `DEMO_BLOCKED_POST_PATTERNS` in `server/demoSandbox.ts` (the demo
  write-guard) — a demo visitor (as jay@) must not change the shared demo
  persona's avatar. The same guard already blocks the parent/child photo,
  profile, and every other persisting edit for demo accounts (added 2026-06-05).

---

## 8. Work breakdown (when un-parked)

1. **Safety first:** moderation pipeline + the per-fund parent-hide table +
   hide/report UI. *(Gating — see §6.)*
2. `<GifterAvatar>` shared component; refactor the existing initials markup into
   it (no visual change).
3. Server: add `gifterPhotoUrl` (senderEmail → users.photoUrl, minus hide flag)
   to the gifter-roster / gift-list payloads.
4. "My Gifts" upload block (reuse Account upload).
5. Wire the surfaces in §5 to `<GifterAvatar>`.
6. Copy: upload consent line; the parent's hide/report affordance.

---

## 9. Timing

**Post-launch.** It's a genuine gifter-delight enhancement, **not** a
loop-proving must-have (funded-k), so it does NOT jump the launch queue. The
safety controls (§6) are real work and are the true gate. Un-park after launch.

*Founder note 2026-06-05: greenlit the idea + the gifter-only / initials-fallback
design; asked for this parked spec, not a build.*
