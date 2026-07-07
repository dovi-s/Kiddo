# Recurring Memory Items — Build Spec

Scope: make the "memory" attached to a recurring investment/gift **editable, addable, and consistent** across parent + gifter. Written from a read-only system map (2026-07-07). Hand to a fresh build pass.

## Current system (ground truth)

**Parent recurring** carries a memory item = **note (text) + media (photo/video/voice)**:
- Setup collects both: `autoInvestMemoryNote` + `autoInvestMedia` (`DashboardStaging.tsx:2175,2177`); the "note" step renders a textarea + `MemoryMediaPicker` (`:17471-17496`).
- **Media is kickoff-only by design** — only the first entry keeps media ("Memory Book doesn't get the same photo 216 times over 18 years", `:17482-17485`). Schema `parent_contributions` has only a `note` text column, **no media columns** (`shared/schema.ts:969`).
- Per cycle, the worker stamps the **note text** as that gift's `message` (`recurringContributionWorker.ts:210`); it writes a `memory_entries` row **only on cycle 1** (`:285-306`). Cycles 2..N surface in the Memory Book via the gift-message feed, not stored rows.
- Editing/adding works via the **full edit flow only** (amount→target→save→note step; `handleSaveAutoInvest` always advances to the note step, hydrating the existing note or blank if none — `:6289-6297`). No dedicated note affordance; the "Edit" button doesn't even mention the note (`:18261`).

**Gifter recurring** carries **no memory item at all**: `recurring_gifts` has no note/message/media columns (`schema.ts:892-926`); the setup endpoint ignores them (`routes.ts:16286`); and it's **reminder-only — it never charges** (`recurringContributionWorker.ts:693-699`), so no gift fires and nothing reaches the Memory Book. (A gifter's *one-time* gift IS full-featured: message + photo/video/voice.)

**Known correctness nit:** `schema.ts:965-968` comment says a memory entry is written "on every successful auto-fire" — the code writes it **only on cycle 1**. Stale comment.

---

## Layer 1 — Parent memory edit/add (small, do first)

**Goal:** one obvious, in-context control to edit an existing recurring memory OR add one where none exists — without walking the whole edit flow.

**Where:** the schedule detail (`DetailHistoryModal` / the dashboard schedule detail) already *displays* the "Memory note." Put the affordance right there:
- Note present → **"Edit note"** (pencil).
- Note absent → **"Add a note for {child}"** placeholder row.

**Behavior:** opens straight to the existing note step (note textarea + `MemoryMediaPicker`), pre-filled, skipping amount/target.

**Semantics to get right (not a patch):**
1. Editing the note should `PATCH /api/parent-contributions/:id { note }` and update its Memory Book entry — it must **not** re-fire a fresh kickoff media `POST /memory`. The current edit path can create a **duplicate kickoff** because `autoInvestMedia` resets to `EMPTY_MEMORY_MEDIA` on modal open and isn't rehydrated (`DashboardStaging.tsx:6321, 16775`). Fix: scope the note-only edit to the note PATCH, or rehydrate + dedupe the kickoff entry.
2. Decide media-on-edit intent: since media is kickoff-only, a later "edit" realistically edits **text**. If media editing is wanted, rehydrate existing media so it's a true edit, and update (not duplicate) the kickoff entry.
3. Fix the stale schema comment (`schema.ts:965-968`).

**Surfaces to keep aligned:** the note also shows in Activity's schedule detail — mirror the affordance or route both to the same step.

---

## Layer 2 — Gifter recurring memory (bigger, own project)

**The gap:** a gifter who "goes recurring" **loses all the warmth** their one-time gift would carry (message + photo/video/voice) and produces zero Memory Book presence. The gifter is the customer/moat — this asymmetry is worth closing.

**Why it's a project, not a tweak:**
1. `recurring_gifts` needs memory columns (`note` + `photoUrl/videoUrl/audioUrl` or a media ref) — schema migration.
2. Setup endpoint (`POST /api/recurring-gifts`) must accept + store them.
3. **Gifter recurring is reminder-only today** (never charges). Per-cycle memory only makes sense once/if it actually fires a gift (auto-charge path exists via `stripeSubscriptionId` but the reminder-only branch dominates). Resolve "does gifter recurring charge?" first.
4. Worker must stamp the message/media onto each fired gifter gift (kickoff-only for media, mirroring parent).
5. Memory Book already renders gifter `gift_message` entries with media — so display is mostly free once gifts fire with content.

**Recommendation:** design Layer 2 alongside the "does gifter recurring auto-charge" decision; don't bolt memory onto a reminder-only mechanism.

---

## Sequencing
Land the current uncommitted work + promote first (so the schedule-detail surfaces are aligned live), then build Layer 1 on clean ground, screenshot it. Layer 2 is its own project gated on the gifter-recurring-charge decision.
