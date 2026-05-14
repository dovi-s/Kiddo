import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Check, X, ChevronDown } from "lucide-react";
import { useActivities } from "@/hooks/use-activities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvents } from "@/lib/realtime-context";
import { Link, useLocation } from "wouter";
import { shouldSuppressFundChrome } from "@/lib/page-scope";
import type { Activity, Fund } from "@shared/schema";
import { LOCAL_CACHE_KEYS, readLocalCache } from "@/lib/local-cache";
import { useAuth } from "@/hooks/use-auth";
import { getActiveFundId, setActiveFundId, ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import { useActionItems } from "@/hooks/use-action-items";
import { ActionItemList } from "@/components/ActionItemCard";
import { haptic } from "@/lib/haptics";

const NOTIF_LAST_READ_KEY = "kiddo.notif.lastReadAt";
const NOTIF_READ_IDS_KEY = "kiddo.notif.readIds";
// Inverse of NOTIF_READ_IDS_KEY: ids the user has EXPLICITLY marked
// as unread via swipe-on-past-row. Honored ahead of the implicit
// lastReadAt comparison so promoting a single past row to unread
// doesn't bulk-flip every other item with createdAt > lastReadAt.
// Cleared on Mark-all-read (everything becomes read; explicit
// unreads can't out-vote a global "I've seen everything" stamp).
const NOTIF_UNREAD_IDS_KEY = "kiddo.notif.unreadIds";
// Custom DOM event broadcast whenever notification read-state changes
// (mark-all-read, mark-one-read, undo). Listened to by every consumer
// that derives "what's still unread" — bell badge, mobile nav dot,
// notifications panel itself. Fixes the cross-component staleness bug
// where the panel updated localStorage but the bell badge stayed at
// the pre-mark count until an unrelated re-render shook it loose.
const NOTIF_READ_STATE_EVENT = "kiddo.notif.read-state-changed";

function broadcastReadStateChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIF_READ_STATE_EVENT));
}

// Public helper for surfaces other than the bell panel that should
// also count as "user has seen the latest activity." The Activity
// page calls this on mount — the page IS the comprehensive view, so
// landing on it implicitly clears the dot. Without this, the user
// taps Activity, scrolls, leaves, and the dot is still there because
// only the bell panel's mark-all-read writes lastReadAt.
//
// Idempotent: writes the effective timestamp + clears readIds. Safe to
// call repeatedly. Broadcasts so every consumer (bell badge, tab
// dot, panel) re-derives.
//
// SERVER CLOCK SKEW DEFENSE — load-bearing. The unread count is
// computed by comparing each activity's server-generated `createdAt`
// against this client-written `lastReadAt`. If the server clock is
// AHEAD of the client (NTP drift, container clock, deployment lag —
// even a few hundred milliseconds is enough), then activities created
// just before the user marks read have `createdAt > Date.now()`, and
// the comparison `createdAt > lastReadAt` stays TRUE, so the dot
// pops back the moment after the user clears it. Reproducible bug
// from the user: "I read it, then it marks itself unread again."
//
// Fix: callers pass `latestActivityTime` — the max createdAt across
// the currently-visible activity feed. We then write
// `max(Date.now(), latestActivityTime + 1)` so the mark provably
// covers every activity the user could have seen, regardless of how
// far ahead the server clock is. Falls back to plain Date.now() when
// the caller doesn't have the data (e.g., legacy callsites).
export function markNotificationsRead(latestActivityTime?: number): void {
  if (typeof window === "undefined") return;
  const clientNow = Date.now();
  const fromLatest = typeof latestActivityTime === "number" && Number.isFinite(latestActivityTime)
    ? latestActivityTime + 1
    : 0;
  const lastRead = Math.max(clientNow, fromLatest);
  try {
    localStorage.setItem(NOTIF_LAST_READ_KEY, String(lastRead));
    saveReadIds(new Set());
    // Also clear explicit unreadIds — visiting the Activity page is
    // a comprehensive "I've seen everything" signal. Same reasoning
    // as Mark-all-read clearing it. Without this, swipe-mark-unread
    // would stay sticky across an Activity-page visit, which
    // contradicts the "Activity is the reference layer" mental
    // model.
    saveUnreadIds(new Set());
    broadcastReadStateChange();
  } catch {
    // localStorage write failures are non-fatal; the dot just stays
    // until the next successful write.
  }
}

// Shared subscriber hook — reads lastReadAt + readIds from localStorage
// on mount, refreshes whenever the broadcast event fires. Single source
// of truth across the bell badge, the activity-tab dot, and the panel.
// Without this, each consumer reads localStorage in its own useMemo with
// stale closure semantics — markAllRead could write the new value but
// other components wouldn't know to re-render until something else
// shook them.
function useNotificationReadState(): {
  lastReadAt: number;
  readIds: Set<string>;
  unreadIds: Set<string>;
} {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setTick((t) => (t + 1) % 1_000_000);
    window.addEventListener(NOTIF_READ_STATE_EVENT, handler);
    // Cross-tab support: the storage event fires when ANOTHER tab
    // writes to localStorage. Without this, marking-as-read in tab A
    // doesn't update tab B's badge until tab B explicitly refreshes.
    const storageHandler = (e: StorageEvent) => {
      if (
        e.key === NOTIF_LAST_READ_KEY ||
        e.key === NOTIF_READ_IDS_KEY ||
        e.key === NOTIF_UNREAD_IDS_KEY
      ) {
        setTick((t) => (t + 1) % 1_000_000);
      }
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(NOTIF_READ_STATE_EVENT, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);
  return useMemo(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(NOTIF_LAST_READ_KEY) : null;
    const parsed = stored ? parseInt(stored, 10) : 0;
    // Defensive: NaN means corrupt stored value. Treat as 0 (everything
    // unread) rather than NaN-poisoning every comparison.
    const lastReadAt = Number.isFinite(parsed) ? parsed : 0;
    return { lastReadAt, readIds: loadReadIds(), unreadIds: loadUnreadIds() };
    // tick included so the subscriber re-derives when a broadcast fires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
}

// Internal-only types — same suppression as Activity. The legacy
// `monetization_trigger_event` literal stays for old rows; the active type
// names are `upgrade_*` (upgrade_viewed / upgrade_landed / upgrade_dismissed
// etc.) written by logMonetizationActivity. Both are pure CTA-funnel
// analytics, never user-facing — bell badge and panel must hide them.
function isInternalOnlyActivity(type?: string | null): boolean {
  const t = String(type || "");
  return t === "monetization_trigger_event" || t.startsWith("upgrade_");
}

// Bell triage filter — types that are NOISE in the notifications panel
// but VALID in the Activity tab's full-history view. The bell is the
// "needs your attention" surface (Robinhood / iOS Mail register); the
// Activity tab is the comprehensive ledger. Without this filter, the
// bell duplicates Activity and reads as ambient noise — every routine
// auto-invest fire, every parent's own memory edit, every subscription
// renewal pings the badge. The included types are: gift events from
// gifters (someone gave!), action-required signals (held gifts, kid
// suggestions, payment failures, KYC), state changes (plan activated/
// canceled, KYC approved, bank linked), milestones, age-phase lifecycle.
// Excluded types are the parent's OWN actions (their memory edits,
// strategy changes, schedule pauses, suggestion approvals) and routine
// system flows (auto-invest fires, subscription renewals, settlement
// events) — the parent already knows about those, and they pile up.
const BELL_EXCLUDED_TYPES = new Set<string>([
  // Routine system flows — the parent already knows the rhythm
  "auto_invest",
  "cash_invested",
  "parent_contribution",          // parent's own scheduled contribution fire
  "subscription_renewal",         // routine Kiddo+ / Family billing
  "large_gift_hold_released",     // auto-released after the hold window
  "gift_invested",                // de-duped against gift_received but defensive
  // Parent's own administrative actions — not "things to learn about"
  "memory_entry_added",
  "memory_milestone_added",
  "memory_entry_edited",
  "memory_entry_deleted",
  "event_created",
  "event_archived",
  "event_unarchived",
  "fund_strategy_changed",
  "custom_allocations_changed",
  "child_profile_updated",
  "recurring_paused",
  "recurring_resumed",
  "kid_suggestion_approved",
  "kid_suggestion_declined",
  "gifter_recurring_resumed",     // positive but not actionable
  "bank_unlinked",
  "ssn_provided",
]);
function isBellNoise(type?: string | null): boolean {
  return BELL_EXCLUDED_TYPES.has(String(type || ""));
}

// Activity types that are now rendered as action-item CARDS at the top
// of the panel (Needs-your-attention section). Filtered out of the
// informational unread list so the same problem isn't shown twice —
// once as a card with a Fix CTA, once as a plain informational row.
// When the action item resolves server-side, the underlying activity
// row stays in the Activity ledger for the audit trail but stops
// surfacing here. Kept aligned with the types `deriveActionItemsForUser`
// emits in `server/actionItems.ts` — if a new derived action-item type
// gets added there, add the corresponding activity type here too.
const ACTION_ITEM_REPRESENTED_TYPES = new Set<string>([
  "kyc_action_required",
  "kyc_pending_review",
  "payment_failed",
  "large_gift_hold_started",
  "ssn_missing",
  // age18_handoff_ready fires as an activity row at T-0; once the
  // handoff stalls past 90 days the stalled_handoff action item
  // takes over as the visible affordance. Hide the original activity
  // row from the bell informational list since the action item card
  // is doing the work.
  "age18_handoff_ready",
]);
function isRepresentedByActionItem(type?: string | null): boolean {
  return ACTION_ITEM_REPRESENTED_TYPES.has(String(type || ""));
}

// Dedupe paired gift rows — server writes BOTH `gift_received` (social
// event: "Gift from Dovi") AND `gift_invested` (brokerage event: "Invested
// in AAPL") for every settled gift. Correct for the audit ledger, but
// reads as duplicates in the triage panel. Drop `gift_invested` rows
// when a `gift_received` for the same `giftId` is also visible. Mirrors
// the Activity feed's dedupe so both surfaces are consistent.
function dedupeGiftPairs<T extends { type?: string | null; metadata?: unknown }>(items: T[]): T[] {
  const receivedGiftIds = new Set<string>();
  for (const a of items) {
    if (String(a.type || "") !== "gift_received") continue;
    try {
      const meta = JSON.parse(String((a as any).metadata || "{}"));
      if (typeof meta.giftId === "string") receivedGiftIds.add(meta.giftId);
    } catch { /* ignore malformed metadata */ }
  }
  return items.filter((a) => {
    if (String(a.type || "") !== "gift_invested") return true;
    try {
      const meta = JSON.parse(String((a as any).metadata || "{}"));
      const gid = typeof meta.giftId === "string" ? meta.giftId : null;
      return !(gid && receivedGiftIds.has(gid));
    } catch {
      return true;
    }
  });
}

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIF_READ_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveReadIds(ids: Set<string>) {
  try { localStorage.setItem(NOTIF_READ_IDS_KEY, JSON.stringify(Array.from(ids))); } catch {}
}
function loadUnreadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIF_UNREAD_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveUnreadIds(ids: Set<string>) {
  try { localStorage.setItem(NOTIF_UNREAD_IDS_KEY, JSON.stringify(Array.from(ids))); } catch {}
}

type FeedActivity = Activity & { fundName?: string | null; recipientFirstName?: string | null };

function getNotifEmoji(a: Activity): string {
  const t = a.type || "";
  const title = (a.title || "").toLowerCase();
  const desc = (a.description || "").toLowerCase();
  if (t === "gift_received" || t === "gift_invested") return "🎁";
  if (t === "auto_invest" || t === "cash_invested") return "↻";
  if (t.startsWith("memory_") || t === "memory_entry_added") return "📖";
  if (t === "kyc_approved") return "✅";
  if (t === "bank_linked") return "🏦";
  if (t === "age18_handoff_ready") return "🎓";
  if (t.includes("plan_activated") || t === "subscription_started") return "⭐";
  if (title.includes("crossed") || title.includes("milestone") || title.includes("hit ")) return "🌟";
  // Birthday-specific: only when title/description actually mentions birthday
  if (title.includes("birthday") || desc.includes("birthday")) return "🎂";
  // Graduation / holiday / other event types by title keywords
  if (title.includes("graduation") || title.includes("graduate")) return "🎓";
  if (title.includes("baby") || title.includes("shower")) return "🍼";
  if (title.includes("holiday") || title.includes("christmas") || title.includes("hanukkah")) return "🎄";
  // Lifecycle nudges - these are reminders/prompts, not celebrations
  if (t.startsWith("lifecycle_")) return "💡";
  return "📣";
}

type IconTone = "green" | "gold" | "amber" | "sage";
function getIconTone(a: Activity): IconTone {
  const t = a.type || "";
  const title = (a.title || "").toLowerCase();
  const desc = (a.description || "").toLowerCase();
  if (t === "gift_received" || t === "gift_invested") return "green";
  if (t === "auto_invest" || t === "cash_invested" || t.startsWith("memory_")) return "sage";
  if (title.includes("birthday") || desc.includes("birthday")) return "amber";
  if (t.includes("plan_activated") || t === "subscription_started" || title.includes("crossed") || title.includes("milestone") || title.includes("hit ")) return "gold";
  if (t.startsWith("lifecycle_")) return "sage";
  return "green";
}

const toneStyles: Record<IconTone, { bg: string; border: string }> = {
  green: { bg: "rgba(26,61,43,0.086)", border: "rgba(26,61,43,0.125)" },
  sage:  { bg: "rgba(43,88,64,0.086)", border: "rgba(43,88,64,0.125)" },
  amber: { bg: "rgba(122,92,30,0.086)", border: "rgba(122,92,30,0.125)" },
  gold:  { bg: "rgba(197,130,30,0.086)", border: "rgba(197,130,30,0.125)" },
};

const fundPillColors = [
  { bg: "#EDF4EE", text: "#1A3D2B" },
  { bg: "#FDF5E4", text: "#B8791A" },
  { bg: "#EEF3FF", text: "#2D5AA0" },
  { bg: "#FFF0F5", text: "#9C2060" },
];

// Parse the activity's metadata for a giftId / memoryEntryId. Activities
// emitted by the gift webhook stash these as JSON in `metadata`. We surface
// them so the notification can deep-link into Memory Book and land on the
// SPECIFIC entry — same scroll-and-highlight pattern as the auto-invest
// "Next: $X · View →" path. Falls back gracefully when metadata is missing
// or malformed (older activities, server-side errors).
function parseActivityMetadata(a: FeedActivity): { giftId?: string; memoryEntryId?: string; eventId?: string } {
  const raw = (a as any).metadata;
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw) as { giftId?: unknown; memoryEntryId?: unknown; eventId?: unknown };
    return {
      giftId: typeof parsed.giftId === "string" ? parsed.giftId : undefined,
      memoryEntryId: typeof parsed.memoryEntryId === "string" ? parsed.memoryEntryId : undefined,
      // eventId added 2026-05-12 so event-specific lifecycle nudges
      // (event_ready_to_share, event_created_no_share, share_no_checkout)
      // can deep-link to the right event if the trigger payload carries
      // one. Falls back to the /events list when absent. Same pattern as
      // giftId / memoryEntryId — opt-in deep-link, graceful degrade.
      eventId: typeof parsed.eventId === "string" ? parsed.eventId : undefined,
    };
  } catch {
    return {};
  }
}

// Notification destination router. Every activity type that can land in
// the bell must have an explicit branch here — falling through to the
// default `/dashboard` route is the canonical "clicks to somewhere dumb"
// bug the user flagged 2026-05-12. Whole audit (every type emitted by
// server-side createActivity calls, cross-checked against BELL_EXCLUDED_TYPES):
//
//   GIFT FAMILY (→ Memory Book entry)
//     gift_received, gift_received_cash, gift_invested, first_gift_received
//     large_gift_hold_started  (the gift exists; parent learns about the hold)
//     refund                   (parent reviews the gift that was refunded)
//
//   MEMORY FAMILY (→ Memory Book + entry anchor)
//     memory_*  (any subtype)
//
//   AUTO-INVEST / RECURRING (→ Dashboard auto-invest modal)
//     auto_invest, cash_invested  (bell-excluded today, defensive branch)
//     parent_contribution_failed  (parent must fix payment method)
//
//   BILLING / SUBSCRIPTION (→ Account → Plan & billing)
//     subscription_started, subscription_canceled
//     payment_failed              (card declined on subscription)
//     anything matching "plan_activated"
//
//   IDENTITY / VERIFICATION
//     kyc_action_required → /activate?fundId=X  (user must finish KYC)
//     kyc_approved        → /dashboard?fund=X   (informational; investing is unlocked)
//     kyc_pending_review  → /dashboard?fund=X   (informational; nothing to do)
//     bank_linked         → /settings?tab=money
//     ssn_missing         → /dashboard?fund=X   (SSN nudge lives on the dashboard)
//
//   KID-AT-18 LIFECYCLE (→ /age-18-plan, scoped by active fund set on click)
//     Every age18_* type + kid_age_18_reached + kid_claimed_fund.
//     Previously fell through to /dashboard — the biggest miss of the audit.
//
//   MILESTONES (→ Dashboard hero)
//     milestone_*  + title-keyword "crossed"/"hit"/"milestone"
//     Was previously /dashboard?fund=X&section=holdings, but the carousel
//     anchor is hidden (project_dashboard_holdings_carousel_hidden.md).
//
//   EVENTS
//     event_pass_purchased → /events
//
//   LEDGER (→ /activity)
//     sell, withdrawal, liquidation_requested
//
//   LIFECYCLE NUDGES (split by signal type)
//     lifecycle_event_*  → /events
//     lifecycle_no_gift_14d / first_gift_received → Dashboard share modal
//
//   DEFAULT (→ /dashboard?fund=X)
//     Catches fund_created, fund_closed, fund_reopened, kid_stock_suggestion,
//     anything new that hasn't been wired explicitly. Acceptable fallback
//     because the active fund is set BEFORE navigation by handleClick.
//
// Active fund is always set via setActiveFundId(activity.fundId) in the
// click handler BEFORE setLocation runs, so destinations that read
// getActiveFundId() (Age18Plan, Events, Activity, Settings) all land
// scoped to the right child without explicit query strings.
function getNotifDestination(a: FeedActivity): string {
  const t = a.type || "";
  const fundId = a.fundId || "";
  const title = (a.title || "").toLowerCase();
  const meta = parseActivityMetadata(a);

  // GIFT FAMILY — deep-link to the specific gift's Memory Book entry so
  // the tap lands on the row it referred to (scroll + gold highlight).
  // Falls back to unfiltered Memory Book when the activity predates the
  // giftId metadata stash. large_gift_hold_started + refund route here
  // too — both are events ABOUT a gift, and the gift is in Memory Book.
  if (
    t === "gift_received" ||
    t === "gift_invested" ||
    t === "gift_received_cash" ||
    t === "first_gift_received" ||
    t === "large_gift_hold_started" ||
    t === "refund"
  ) {
    if (!fundId) return "/dashboard";
    return meta.giftId ? `/memory/${fundId}?gift=${encodeURIComponent(meta.giftId)}` : `/memory/${fundId}`;
  }

  // MEMORY FAMILY — entries from gifts have giftId, parent-authored entries
  // and milestones have memoryEntryId. Either anchors the deep link.
  if (t.startsWith("memory_") || t === "memory_entry_added") {
    if (!fundId) return "/dashboard";
    if (meta.giftId) return `/memory/${fundId}?gift=${encodeURIComponent(meta.giftId)}`;
    if (meta.memoryEntryId) return `/memory/${fundId}?highlight=${encodeURIComponent(meta.memoryEntryId)}`;
    return `/memory/${fundId}`;
  }

  // AUTO-INVEST FAILURES — the recurring worker tried to pull from the
  // parent's card-on-file and the PM declined. Parent has to either
  // update billing in Stripe (→ /settings?tab=membership covers the
  // card) or pause/adjust the schedule. The auto-invest modal is the
  // primary management surface; pre-fill via openAutoInvest=1.
  if (t === "parent_contribution_failed") {
    return fundId ? `/dashboard?fund=${fundId}&openAutoInvest=1` : "/dashboard";
  }
  // Routine auto-invest fires are bell-excluded; this branch is defensive
  // for any that slip through.
  if (t === "auto_invest" || t === "cash_invested") {
    return fundId ? `/dashboard?fund=${fundId}&openAutoInvest=1` : "/dashboard";
  }

  // BILLING / SUBSCRIPTION — every billing-related signal lands on
  // Account → Plan & billing where the user manages their plan, sees
  // billing status, and (for payment_failed) updates card. Updated
  // 2026-05-14 from /settings?tab=membership to /account?tab=plan
  // per the WHO/HOW IA Phase 1c: Account is the primary home of
  // plan management. The Settings membership tab still works as a
  // backward-compat redirect for any in-flight notifications that
  // were enqueued with the old URL.
  if (
    t === "subscription_started" ||
    t === "subscription_canceled" ||
    t === "payment_failed" ||
    t.includes("plan_activated")
  ) {
    return "/account?tab=plan";
  }

  // IDENTITY / VERIFICATION
  if (t === "kyc_action_required") {
    // The /activate page reads ?fundId=X explicitly (not the generic
    // ?fund=X). Keep the param name aligned with the page's parser.
    return fundId ? `/activate?fundId=${fundId}` : "/activate";
  }
  if (t === "kyc_approved" || t === "kyc_pending_review") {
    return fundId ? `/dashboard?fund=${fundId}` : "/dashboard";
  }
  if (t === "bank_linked") {
    return "/settings?tab=money";
  }
  if (t === "ssn_missing") {
    // SSN nudge lives inline on the Dashboard above the hero card.
    return fundId ? `/dashboard?fund=${fundId}` : "/dashboard";
  }

  // KID-AT-18 LIFECYCLE — every age18_* type + the two kid_* terminal-state
  // types belong on /age-18-plan. Active fund set by click handler scopes
  // it to the correct child. age18_handoff_ready kept for legacy rows.
  if (
    t.startsWith("age18_") ||
    t === "age18_handoff_ready" ||
    t === "kid_age_18_reached" ||
    t === "kid_claimed_fund"
  ) {
    return "/age-18-plan";
  }

  // MILESTONES — dashboard hero (was previously routing to the now-hidden
  // holdings carousel via #section=holdings; that anchor silently no-ops).
  if (
    t.startsWith("milestone_") ||
    title.includes("milestone") ||
    title.includes("crossed") ||
    title.includes("hit ")
  ) {
    return fundId ? `/dashboard?fund=${fundId}` : "/dashboard";
  }

  // EVENT PASS PURCHASED — a gifter bought an event upgrade. Parent
  // wants to see the event; /events list scoped to their active fund.
  if (t === "event_pass_purchased") {
    return "/events";
  }

  // LEDGER EVENTS — sells, withdrawals, liquidations are money-movement
  // records. Activity is the canonical ledger surface (Dashboard is
  // hero/glance; Activity is where the audit history lives).
  if (t === "sell" || t === "withdrawal" || t === "liquidation_requested") {
    return "/activity";
  }

  // LIFECYCLE NUDGES — event-specific signals → /events, share-the-link
  // signals → Dashboard share modal. eventId deep-link preserved as
  // forward-compat decoration; Events.tsx can wire `?event=X` when ready.
  if (t.startsWith("lifecycle_")) {
    const isEventSignal =
      t === "lifecycle_event_ready_to_share_1h" ||
      t === "lifecycle_event_created_no_share_24h" ||
      t === "lifecycle_share_no_checkout_48h";
    if (isEventSignal) {
      if (meta.eventId) return `/events?event=${encodeURIComponent(meta.eventId)}`;
      return "/events";
    }
    return fundId ? `/dashboard?fund=${fundId}&openShare=1` : "/dashboard";
  }

  // DEFAULT — fund-scoped dashboard. Catches fund_created, fund_closed,
  // fund_reopened, kid_stock_suggestion, and any future type not yet
  // wired explicitly. handleClick will have set activeFund first, so the
  // dashboard opens scoped to the right child.
  return fundId ? `/dashboard?fund=${fundId}` : "/dashboard";
}

function timeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr as string);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.round(diff / 3600000)}h ago`;
    if (diff < 48 * 60 * 60 * 1000) return "Yesterday";
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.round(diff / 86400000)} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// iOS-Mail-style swipe-to-mark-read wrapper. Used only on unread rows.
// Swipe-to-mark row. Generic over the action: pass in the label,
// icon, and background-reveal color so the same component handles
// BOTH "swipe to mark read" (on unread rows) AND "swipe to mark
// unread" (on past rows). The reveal layer sits behind the row;
// the row drags left over it. Past the threshold (offset OR
// velocity), the action fires.
//
// Color register:
//   - mark-read: evergreen (#1A3D2B) with "✓ Read" — same as Activity-page swipe
//   - mark-unread: gold (#B8791A) with "● Unread" — gold flags "back into your queue"
type SwipeableAction = "mark-read" | "mark-unread";

function SwipeableRow({
  action = "mark-read",
  onCommit,
  children,
}: {
  action?: SwipeableAction;
  onCommit: () => void;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  // Reveal opacity ramps in as the row drags left — the action surface
  // becomes more visible the closer the parent gets to the threshold.
  // Fully opaque by ~60px so the parent has a clear "yes this will commit"
  // affordance well before the 80px commit point.
  const revealOpacity = useTransform(x, [-80, -10, 0], [1, 0.35, 0]);

  const isMarkRead = action === "mark-read";
  const revealBg = isMarkRead ? "#1A3D2B" : "#B8791A";
  const revealLabel = isMarkRead ? "Read" : "Unread";

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Either past the distance threshold OR a fast flick (velocity-based)
    // commits the action. Velocity threshold matches iOS Mail's snappy
    // feel — short, fast swipes shouldn't require travel distance.
    if (info.offset.x < -80 || info.velocity.x < -500) {
      haptic("selection");
      onCommit();
    }
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", background: revealBg }}>
      {/* Reveal layer — sits behind the row, becomes visible as the row drags off */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 22,
          gap: 6,
          color: "white",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.02em",
          pointerEvents: "none",
          opacity: revealOpacity,
        }}
      >
        {isMarkRead ? (
          <Check size={14} strokeWidth={3} />
        ) : (
          // Small filled dot — matches the unread-pip vocabulary used
          // on each row. Not an icon import (kept inline for the same
          // reason the unread pip in the row is a styled div: tiny,
          // self-contained, no need for the Lucide weight here).
          <span aria-hidden style={{ display: "inline-block", width: 7, height: 7, borderRadius: 9999, background: "white" }} />
        )}
        <span>{revealLabel}</span>
      </motion.div>

      {/* Foreground row — drag-x only, snaps back if not committed */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x, position: "relative", touchAction: "pan-y" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ isOpen, onClose }: NotificationsPanelProps) {
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  // First-open tick. Each time the panel transitions closed→open we
  // bump a counter; rows use this as their motion `key` so the
  // staggered reveal replays. Subsequent state changes within the
  // same open session (swipe-mark-read, Show-hide toggle) don't
  // bump the tick, so they don't re-stagger.
  const [openTick, setOpenTick] = useState(0);
  useEffect(() => {
    if (isOpen) setOpenTick((t) => t + 1);
  }, [isOpen]);
  // Read state via the shared subscriber — same source of truth the
  // bell badge and Activity-tab dot use. When this component mutates
  // localStorage (markAllRead etc.) it also dispatches the read-state
  // event; the subscriber re-derives, every consumer re-renders.
  const { lastReadAt, readIds, unreadIds } = useNotificationReadState();
  // Open action items — server-derived, always cross-fund. Unlike the
  // informational notifications below (which scope to the active fund
  // on fund-scoped pages), open todos float above the scope filter:
  // a pending KYC on Liam's fund matters even when the parent is
  // parked on Emma's Dashboard, because the parent is the actor.
  // This also keeps the panel's count consistent with the bell badge,
  // which already counts action items cross-fund regardless of page.
  const { items: actionItems } = useActionItems();
  const actionItemCount = actionItems.length;
  // Notifications panel follows the GLOBAL active fund on fund-scoped
  // pages (Dashboard, Memory, Activity, etc.) and switches to ALL
  // funds on non-fund-scoped pages (/funds, /account). No in-panel
  // chip switcher: that was a parallel UI that let the panel desync
  // from the rest of the app, and duplicated the AppHeader's fund
  // picker. To see another fund's notifications on a fund-scoped
  // page, the parent switches funds via AppHeader and the panel
  // updates reactively. On non-fund-scoped pages, "all" matches
  // the page's mental model — household-glance on /funds, user-
  // identity on /account — and surfaces cross-fund signals that
  // would otherwise be hidden behind the active-fund filter.
  const [trackedActiveFundId, setTrackedActiveFundId] = useState<string>(() => getActiveFundId() || "all");
  useEffect(() => {
    const handler = () => {
      const next = getActiveFundId();
      setTrackedActiveFundId(next || "all");
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);
  // Effective fund filter — derived from the location's scope tier
  // each render so navigating between fund-scoped and non-fund-scoped
  // pages updates the panel without an explicit state set.
  const fundFilter = shouldSuppressFundChrome(location) ? "all" : trackedActiveFundId;

  const { data: activitiesRaw = [] } = useActivities(40, isAuthenticated);
  // Apply gift-pair dedupe before any downstream rendering / filtering.
  // Cuts notification noise roughly in half on every settled gift since
  // we no longer surface both halves of each gift event.
  const activities = useMemo(
    () => dedupeGiftPairs(activitiesRaw as FeedActivity[]),
    [activitiesRaw],
  );
  const { data: funds = [] } = useQuery<Fund[]>({
    queryKey: ["/api/funds"],
    queryFn: async () => {
      const res = await fetch("/api/funds", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
    initialData: () => readLocalCache<Fund[]>(LOCAL_CACHE_KEYS.funds),
    initialDataUpdatedAt: 0,
    staleTime: 30000,
  });

  const fundIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    funds.forEach((f, i) => m.set(f.id, i));
    return m;
  }, [funds]);

  // Explicit unreadIds win against every other signal — a parent who
  // swiped a past row to "Unread" should see that row stay in the
  // unread list even if lastReadAt is way past its createdAt. Falls
  // back to the standard "newer than lastReadAt AND not in readIds"
  // for the natural unread state.
  const isActivityUnread = (a: FeedActivity) => {
    const id = String(a.id);
    if (unreadIds.has(id)) return true;
    if (readIds.has(id)) return false;
    return new Date(a.createdAt!).getTime() > lastReadAt;
  };

  // Split into unread + read. Notifications is a TRIAGE layer — unread comes
  // first (the "what's new since I last looked" job), and read items collapse
  // behind an expandable row so they don't compete visually. The Activity
  // page is the REFERENCE layer where parents go for full history, search,
  // and money math — we link there explicitly so the two surfaces hand off
  // cleanly instead of duplicating each other's job.
  const { visibleUnread, visibleRead, overflowUnread, totalReadCount } = useMemo(() => {
    const scoped = (activities as FeedActivity[])
      .filter((a) => !isInternalOnlyActivity(a.type))
      // Bell triage filter — keeps the panel about "things worth a
      // glance," not the comprehensive ledger. Activity tab carries
      // the full history (search, filter, CSV export); the bell
      // shows what changed that the parent might want to know.
      .filter((a) => !isBellNoise(a.type))
      // Activity rows that map to derived action items (KYC, SSN,
      // payment failed, large-gift hold) are rendered as cards in the
      // Needs-your-attention section at the top of the panel. Drop
      // them from the informational list so the same problem doesn't
      // appear twice. The Activity page keeps these rows for audit.
      .filter((a) => !isRepresentedByActionItem(a.type))
      .filter((a) => fundFilter === "all" || a.fundId === fundFilter);
    const unread: FeedActivity[] = [];
    const read: FeedActivity[] = [];
    for (const a of scoped) {
      if (isActivityUnread(a)) unread.push(a);
      else read.push(a);
    }
    // Cap unread at 10 in the panel — anything beyond hands off to Activity.
    const unreadCap = 10;
    // Cap read at 8 when expanded — same handoff philosophy.
    const readCap = 8;
    return {
      visibleUnread: unread.slice(0, unreadCap),
      visibleRead: read.slice(0, readCap),
      overflowUnread: Math.max(0, unread.length - unreadCap),
      totalReadCount: read.length,
    };
    // Re-derive when fund filter changes or read state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, fundFilter, lastReadAt, readIds]);

  // Local UI state for the read-section toggle. Defaults closed — the whole
  // point of the triage layer is to keep already-seen items out of the way.
  const [showRead, setShowRead] = useState(false);

  // Header badge respects fund scope. If the user is on Emma's fund, the
  // count reflects Emma's unread, not "all funds" — otherwise the badge
  // reads "9+" while the visible list shows 2 items, which is confusing.
  const unreadCount = useMemo(() => {
    return (activities as FeedActivity[]).filter(
      (a) =>
        !isInternalOnlyActivity(a.type) &&
        // Same triage filter as the panel scope above — without this,
        // the in-panel header count read different from the bell badge,
        // confusing the parent (panel says "2 new" while header reads
        // "5 new" because the header was counting bell-noise types
        // that the panel filtered out).
        !isBellNoise(a.type) &&
        // Mirror the action-item drop from the panel list so the
        // count tracks what the user actually sees as informational
        // rows. Action items are reported separately via
        // actionItemCount and rolled into the header summary below.
        !isRepresentedByActionItem(a.type) &&
        (fundFilter === "all" || a.fundId === fundFilter) &&
        isActivityUnread(a)
    ).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, fundFilter, lastReadAt, readIds]);

  // Handoff to Activity. Panel now follows the global active fund, so the
  // user's Activity scope is already correct on arrival — just close the
  // panel and route. (The previous version set active-fund-from-chip
  // first, but the chip strip is gone now.)
  const handleViewAllInActivity = () => {
    onClose();
    setLocation("/activity");
  };

  const markAllRead = () => {
    // Capture prev state BEFORE the mutation so the undo strip can
    // restore it. Mark-all-read clobbers THREE pieces of state
    // (lastReadAt + readIds + unreadIds), all have to be remembered
    // together for a clean undo.
    const prevLastReadAt = lastReadAt;
    const prevReadIds = new Set(readIds);
    const prevUnreadIds = new Set(unreadIds);
    // Server clock skew defense — see markNotificationsRead doc above.
    // The bug: writing plain Date.now() leaves freshly-loaded activities
    // with createdAt > Date.now() (because the server clock is ahead),
    // so the dot snaps back the moment after the user clears it. Fix:
    // anchor the mark to the latest visible activity's createdAt + 1ms,
    // ensuring every activity the user could have seen is provably
    // covered regardless of clock drift.
    const clientNow = Date.now();
    const latestVisibleTime = (activities as FeedActivity[]).reduce((max, a) => {
      const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      return Number.isFinite(t) && t > max ? t : max;
    }, 0);
    const lastRead = Math.max(clientNow, latestVisibleTime + 1);
    localStorage.setItem(NOTIF_LAST_READ_KEY, String(lastRead));
    saveReadIds(new Set());
    // Clear unreadIds too — Mark-all-read is a global "I've seen
    // everything" stamp; explicit unread markers shouldn't out-vote
    // it. The undo strip captures prevUnreadIds so a tap-Undo
    // restores them.
    saveUnreadIds(new Set());
    // Single broadcast → every consumer (this panel, the bell badge in
    // AppHeader, the Activity-tab dot in MobileNav/DesktopSidebar)
    // re-derives from localStorage. Replaces the previous pattern where
    // the panel updated its own useState but other consumers stayed
    // stale until an unrelated re-render.
    broadcastReadStateChange();
    haptic("light");
    setRecentlyMarkedRead({ kind: "all", prevLastReadAt, prevReadIds, prevUnreadIds });
  };

  const markOneRead = (id: string) => {
    // Read FRESH from localStorage instead of using the closure's
    // readIds. Rapid sequential swipes (e.g., the parent dismisses
    // 3 notifications in quick succession) would otherwise hit a
    // race: each handler captures the readIds from its own render
    // and overwrites the previous handler's write. Reading fresh
    // is cheap (small JSON parse) and atomic enough for the bursty
    // tap pattern.
    const fresh = loadReadIds();
    fresh.add(id);
    saveReadIds(fresh);
    // Also clear from unreadIds in case the parent previously marked
    // this same item unread — read+unread are mutually exclusive
    // states; the latest action wins. Without this, swipe-mark-read
    // on a row the parent had previously swipe-mark-unread'd would
    // visually move it to read but the unreadIds entry would keep
    // promoting it back on the next derive.
    const freshUnread = loadUnreadIds();
    if (freshUnread.has(id)) {
      freshUnread.delete(id);
      saveUnreadIds(freshUnread);
    }
    broadcastReadStateChange();
  };

  // Mirror of markOneRead — promotes a past row back to unread.
  // Adds the id to unreadIds (the explicit unread set) so the
  // isActivityUnread predicate flips. Also removes from readIds in
  // case the row was previously explicitly marked read; same
  // mutual-exclusion logic as markOneRead.
  const markOneUnread = (id: string) => {
    const freshUnread = loadUnreadIds();
    freshUnread.add(id);
    saveUnreadIds(freshUnread);
    const freshRead = loadReadIds();
    if (freshRead.has(id)) {
      freshRead.delete(id);
      saveReadIds(freshRead);
    }
    broadcastReadStateChange();
  };

  // Most recent mark action, surfaced as a brief inline undo strip
  // above the footer. Only ONE undo at a time (iOS Mail register) — a
  // newer action replaces the previous undo target. Auto-dismisses
  // after 4s. Tap-mark-read doesn't get an undo because the tap also
  // closes the panel + navigates, so there's no surface to show the
  // undo on.
  //
  // Three kinds:
  //  - "one"        single swipe-mark-READ on an unread row
  //  - "one_unread" single swipe-mark-UNREAD on a past row
  //  - "all"        Mark-all-read tap (clobbers lastReadAt + readIds
  //                 + unreadIds; the snapshot remembers all three)
  type RecentMarkRead =
    | { kind: "one"; id: string }
    | { kind: "one_unread"; id: string }
    | { kind: "all"; prevLastReadAt: number; prevReadIds: Set<string>; prevUnreadIds: Set<string> };
  const [recentlyMarkedRead, setRecentlyMarkedRead] = useState<RecentMarkRead | null>(null);
  useEffect(() => {
    if (!recentlyMarkedRead) return;
    const t = setTimeout(() => setRecentlyMarkedRead(null), 4000);
    return () => clearTimeout(t);
  }, [recentlyMarkedRead]);
  const swipeMarkRead = (id: string) => {
    markOneRead(id);
    setRecentlyMarkedRead({ kind: "one", id });
  };
  // Mirror of swipeMarkRead: promotes a past row back to unread +
  // captures it as the current undo target so the parent can flip
  // back if it was an accidental swipe.
  const swipeMarkUnread = (id: string) => {
    markOneUnread(id);
    setRecentlyMarkedRead({ kind: "one_unread", id });
  };
  const undoMarkRead = () => {
    if (!recentlyMarkedRead) return;
    if (recentlyMarkedRead.kind === "one") {
      // Undo a swipe-mark-read: remove from readIds. Fresh-read
      // pattern guards against rapid-action / cross-tab races.
      const fresh = loadReadIds();
      fresh.delete(recentlyMarkedRead.id);
      saveReadIds(fresh);
    } else if (recentlyMarkedRead.kind === "one_unread") {
      // Undo a swipe-mark-unread: remove from unreadIds. Item falls
      // back to its natural read state (lastReadAt comparison).
      const fresh = loadUnreadIds();
      fresh.delete(recentlyMarkedRead.id);
      saveUnreadIds(fresh);
    } else {
      // Mark-all-read undo: restore all three pieces of state to the
      // snapshot captured at the moment Mark-all-read fired. Items
      // become unread again exactly as they were before the tap.
      localStorage.setItem(NOTIF_LAST_READ_KEY, String(recentlyMarkedRead.prevLastReadAt));
      saveReadIds(recentlyMarkedRead.prevReadIds);
      saveUnreadIds(recentlyMarkedRead.prevUnreadIds);
    }
    broadcastReadStateChange();
    setRecentlyMarkedRead(null);
    haptic("selection");
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/20"
            onClick={onClose}
          />

          {/* Panel — width clamps to the smaller of 380px and the viewport
              (full-width on phones, fixed-width sliver on tablet/desktop).
              Height uses 100dvh so the panel matches the visible viewport
              on mobile browsers when the URL bar shows/hides instead of
              overshooting and creating a phantom scroll area. */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-[61] flex flex-col bg-white"
            style={{
              width: "min(380px, 100vw)",
              height: "100dvh",
              maxHeight: "100dvh",
              boxShadow: "-4px 0 40px rgba(26,23,16,0.18)",
            }}
            data-testid="notifications-panel"
          >
            {/* Header — top padding respects safe-area-inset-top so the
                close X and "Mark all read" never sit under the status
                bar / dynamic island on notched iOS devices. */}
            <div
              className="flex items-center justify-between px-5 pb-3.5 border-b border-black/[0.07]"
              style={{ paddingTop: "max(20px, env(safe-area-inset-top, 20px))" }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "#1A1710", lineHeight: "20px" }}>
                    Notifications
                  </h2>
                  {(unreadCount + actionItemCount) > 0 && (
                    <span
                      style={{
                        background: "#1A3D2B",
                        color: "white",
                        borderRadius: 9999,
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 6px",
                        lineHeight: "14px",
                      }}
                    >
                      {(unreadCount + actionItemCount) > 9 ? "9+" : (unreadCount + actionItemCount)}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11.5, color: "#6F6860", marginTop: 2, lineHeight: "14px" }}>
                  {(() => {
                    // Lead with what's new (the triage layer's job). When
                    // there's nothing unread, we say so plainly — that's a
                    // good outcome, not an empty state.
                    const scopeLabel = (() => {
                      if (fundFilter === "all") return "all funds";
                      const f = funds.find((f) => f.id === fundFilter);
                      if (!f) return "this fund";
                      const name = f.recipientFirstName || f.name || "Fund";
                      return `${name}'s fund`;
                    })();
                    // Roll action items into the summary. They're
                    // cross-fund always, so the count can be > 0 even
                    // when the scope label says "Emma's fund" — that's
                    // intentional. The "needs you" half makes it clear
                    // that those rows are user-scoped to-dos, not
                    // Emma-specific gifts.
                    if (unreadCount === 0 && actionItemCount === 0) {
                      return totalReadCount > 0
                        ? `All caught up · ${scopeLabel}`
                        : `Nothing yet · ${scopeLabel}`;
                    }
                    const parts: string[] = [];
                    if (actionItemCount > 0) parts.push(`${actionItemCount} to do`);
                    if (unreadCount > 0) parts.push(`${unreadCount} new`);
                    return `${parts.join(" · ")} · ${scopeLabel}`;
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    // Hover/focus via className so the cream-tint affordance
                    // can apply over the inline base. Pill-shaped target
                    // matches the close-X button next to it.
                    className="rounded-full bg-transparent border-none cursor-pointer transition-colors hover:bg-[hsl(var(--kiddo-cream))] focus-visible:bg-[hsl(var(--kiddo-cream))] focus-visible:outline-none"
                    style={{ fontSize: 11.5, fontWeight: 600, color: "#1A3D2B", padding: "4px 10px" }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.10] bg-[#F7F2EB] transition-colors hover:bg-[#ede8de]"
                  data-testid="button-close-notifications"
                  aria-label="Close notifications panel"
                >
                  <X size={14} className="text-[#6F6860]" />
                </button>
              </div>
            </div>

            {/* Fund filter chip strip removed — Notifications follows the
                global active fund (set via AppHeader's picker) so there's
                ONE canonical fund switcher in the app, not two. The header
                line below already reads "Emma's fund" so there's no
                ambiguity about scope. */}

            {/* Activity list. Triage layout: unread first, read collapsed
                behind an expandable row, overflow + history hand off to the
                Activity page (the reference layer). The empty state speaks
                in the same scope-aware voice as the header.
                overscrollBehavior: contain prevents iOS pull-to-refresh on
                the page underneath when the parent over-scrolls inside the
                panel list. */}
            <div
              className="flex-1 overflow-y-auto"
              style={{
                paddingTop: 8,
                // When the footer is suppressed on non-fund-scoped pages,
                // the list becomes the last child of the panel — so it
                // needs its own safe-area-inset-bottom padding, otherwise
                // the last notification can sit under the iOS home
                // indicator. When the footer is visible it already
                // handles safe-area, and the list keeps its tight 8px.
                paddingBottom: shouldSuppressFundChrome(location)
                  ? "max(12px, env(safe-area-inset-bottom, 12px))"
                  : 8,
                overscrollBehavior: "contain",
              }}
            >
              {/* Needs-your-attention section — server-derived open
                  action items (KYC, SSN, payment failed, large-gift
                  hold, fund setup gates). Always cross-fund regardless
                  of which kid's page the parent is parked on, because
                  the parent IS the actor: a pending KYC on Liam's
                  fund matters even when looking at Emma's Dashboard.
                  Each card shows the fund label inline so the parent
                  knows whose todo it is. Compact variant fits the
                  panel's narrow column. Tapping a card closes the
                  panel and routes to the fix surface (handled inside
                  ActionItemCard). */}
              {actionItemCount > 0 && (
                <div
                  style={{
                    padding: "10px 16px 14px",
                    borderBottom: "1px solid rgba(26,23,16,0.07)",
                    background: "rgba(26,23,16,0.015)",
                  }}
                >
                  <ActionItemList
                    items={actionItems}
                    compact
                    heading="Needs your attention"
                  />
                </div>
              )}
              {(() => {
                // Single render-row helper so unread + read sections stay
                // visually consistent. Read items dim slightly so the
                // hierarchy ("new vs old") is felt without being shouted.
                // Unread rows are wrapped in SwipeableRow (iOS Mail register
                // — swipe left past ~80px or flick to mark read); read rows
                // are static (already-read; nothing to dismiss).
                const renderRow = (activity: FeedActivity, opts: { dim?: boolean; index?: number } = {}) => {
                  const isUnread = isActivityUnread(activity);
                  const emoji = getNotifEmoji(activity);
                  const tone = getIconTone(activity);
                  const { bg: iconBg, border: iconBorder } = toneStyles[tone];
                  const fundIdx = activity.fundId ? (fundIndexMap.get(activity.fundId) ?? 0) : 0;
                  const pillStyle = fundPillColors[fundIdx % fundPillColors.length];
                  const childName = (activity as FeedActivity).recipientFirstName || funds.find((f) => f.id === activity.fundId)?.recipientFirstName || null;
                  const when = timeAgo(activity.createdAt?.toString());
                  const destination = getNotifDestination(activity);
                  const handleClick = () => {
                    haptic("selection");
                    if (isUnread) markOneRead(String(activity.id));
                    // Set the global active fund FIRST so the destination
                    // surface (Dashboard, Events, Memory, Settings) opens
                    // scoped to the notification's child. Without this,
                    // clicking Emma's gift notification while currently
                    // viewing Liam's dashboard lands on Liam's surface
                    // even though /memory/<EmmaFundId> is correct — the
                    // active-fund mismatch made the AppHeader chip + sidebar
                    // read "wrong child" and the user reported "clicks
                    // take me to random place." 2026-05-12.
                    if (activity.fundId) {
                      setActiveFundId(String(activity.fundId));
                    }
                    onClose();
                    setLocation(destination);
                  };
                  // Cap stagger delay so a panel with 30+ items doesn't take
                  // 2 seconds to fully reveal. After the 8th item we plateau.
                  const staggerIndex = Math.min(opts.index ?? 0, 8);
                  const staggerDelay = staggerIndex * 0.04;

                  // Solid background is required when wrapped in SwipeableRow
                  // — without it, the evergreen reveal layer bleeds through
                  // the row at rest. EDF4EE for unread, white for read.
                  const rowBg = isUnread ? "#EDF4EE" : "#FFFFFF";
                  // Desktop hover tint, state-aware. Unread rows already
                  // sit on cream-tinted evergreen, so hover steps to a
                  // slightly deeper evergreen (#e3edd9). Read rows sit on
                  // white, so hover lands on the standard kiddo-cream so
                  // the affordance reads. The user surfaced this audit
                  // explicitly — rows previously had `transition: "background
                  // 0.2s"` set but no :hover trigger at all.
                  const rowHoverBg = isUnread ? "#e3edd9" : "hsl(var(--kiddo-cream))";

                  const inner = (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={handleClick}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = rowHoverBg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = rowBg; }}
                      onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.background = rowHoverBg; }}
                      onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.background = rowBg; }}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        padding: "14px 22px",
                        gap: 12,
                        background: rowBg,
                        borderBottom: "1px solid rgba(26,23,16,0.06)",
                        cursor: "pointer",
                        transition: "background 0.2s",
                        opacity: opts.dim ? 0.72 : 1,
                      }}
                    >
                      <div
                        style={{
                          flexShrink: 0,
                          width: 38,
                          height: 38,
                          borderRadius: 16,
                          background: iconBg,
                          border: `1px solid ${iconBorder}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 17,
                          lineHeight: 1,
                        }}
                      >
                        {emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1710", lineHeight: "17px", flex: 1, minWidth: 0 }}>
                            {activity.title}
                          </p>
                          {isUnread && (
                            <div style={{ width: 7, height: 7, borderRadius: 9999, background: "#1A3D2B", flexShrink: 0, marginTop: 5 }} />
                          )}
                        </div>
                        {activity.description && (
                          <p style={{ fontSize: 12, color: "#6F6860", lineHeight: "18px", marginTop: 3 }}>
                            {activity.description}
                          </p>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                          {childName && (
                            <span style={{ background: pillStyle.bg, color: pillStyle.text, borderRadius: 9999, padding: "2px 9px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.02em" }}>
                              {childName}
                            </span>
                          )}
                          {when && <span style={{ fontSize: 10.5, color: "#9B9088" }}>{when}</span>}
                        </div>
                      </div>
                    </div>
                  );

                  // Outer wrapper handles enter/exit animation. AnimatePresence
                  // around the unread list catches the exit when an item is
                  // marked read (either via swipe, tap, or Mark all read).
                  //
                  // The `key` includes openTick so each panel open replays
                  // the staggered reveal — rows fade up with a per-index
                  // delay (8-item cap so big lists don't take forever).
                  // Subsequent in-session state changes don't bump openTick,
                  // so they don't re-stagger.
                  return (
                    <motion.div
                      key={`${activity.id}:${openTick}`}
                      layout
                      initial={{ opacity: 0, y: 6, height: 0 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        height: "auto",
                        transition: {
                          duration: 0.35,
                          ease: [0.16, 1, 0.3, 1],
                          delay: staggerDelay,
                        },
                      }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
                      style={{ overflow: "hidden" }}
                    >
                      {/* Same gesture on both unread + past rows; the
                          action flips based on current state:
                            unread row swiped → mark read (evergreen reveal)
                            past row swiped → mark unread (gold reveal)
                          iOS Mail register: one swipe pattern, state-aware
                          payload. */}
                      <SwipeableRow
                        action={isUnread ? "mark-read" : "mark-unread"}
                        onCommit={() =>
                          isUnread
                            ? swipeMarkRead(String(activity.id))
                            : swipeMarkUnread(String(activity.id))
                        }
                      >
                        {inner}
                      </SwipeableRow>
                    </motion.div>
                  );
                };

                // Empty: nothing to show at all (fresh fund, fresh signup).
                // Action items count against "cold" because if there's
                // a Needs-your-attention card up top, the panel is not
                // empty — the cold-empty message would read as a lie.
                if (
                  visibleUnread.length === 0 &&
                  totalReadCount === 0 &&
                  actionItemCount === 0
                ) {
                  return (
                    <motion.div
                      key={`empty-cold:${openTick}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 } }}
                      className="flex flex-col items-center justify-center h-40 gap-2 px-6 text-center"
                    >
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1710" }}>Nothing needs your attention</p>
                      <p style={{ fontSize: 12, color: "#6F6860", lineHeight: "18px" }}>
                        Gifts arriving, milestones crossed, or anything that needs a decision will show up here.
                      </p>
                    </motion.div>
                  );
                }

                // Action-items-only: open to-dos but no unread/read
                // informational rows. Skip the "You're all caught up"
                // 🌱 (would be a lie — you have to-dos) and skip the
                // cold empty (the action item card already speaks for
                // itself up top). Just render nothing below the
                // section so the cards sit alone, calm.
                if (
                  visibleUnread.length === 0 &&
                  totalReadCount === 0 &&
                  actionItemCount > 0
                ) {
                  return null;
                }

                // All caught up: no unread, but there's read history. Lead
                // with the win, then offer to expand the read list inline.
                // Suppress the 🌱 message when action items exist (the
                // user is NOT all caught up — they have open todos
                // displayed in the cards above).
                if (visibleUnread.length === 0 && actionItemCount > 0) {
                  // Action items rendered above; just offer the past-
                  // notifications toggle here so historical context
                  // is one tap away without claiming everything's done.
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => { haptic("light"); setShowRead((v) => !v); }}
                        style={{
                          width: "100%",
                          padding: "11px 22px",
                          background: "rgba(26,23,16,0.03)",
                          border: "none",
                          borderTop: "1px solid rgba(26,23,16,0.07)",
                          borderBottom: "1px solid rgba(26,23,16,0.07)",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#6F6860",
                          letterSpacing: "0.02em",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span>{showRead ? "Hide" : "Show"} {totalReadCount} past notification{totalReadCount === 1 ? "" : "s"}</span>
                        <motion.span
                          animate={{ rotate: showRead ? 180 : 0 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          style={{ display: "inline-flex", lineHeight: 0 }}
                          aria-hidden
                        >
                          <ChevronDown size={13} strokeWidth={2.4} />
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {showRead && (
                          <motion.div
                            key="read-list-actiononly"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto", transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
                            exit={{ opacity: 0, height: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
                            style={{ overflow: "hidden" }}
                          >
                            {visibleRead.map((a, i) => renderRow(a, { dim: true, index: i }))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  );
                }

                if (visibleUnread.length === 0) {
                  return (
                    <>
                      <motion.div
                        key={`empty-state:${openTick}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 } }}
                        className="flex flex-col items-center justify-center gap-2 px-6 text-center"
                        style={{ paddingTop: 28, paddingBottom: 22 }}
                      >
                        {/* Sprout reveal — spring scale-in matches the
                            Dashboard empty-state vocabulary. The 🌱 is the
                            brand metaphor (see project_brand_metaphor_locked),
                            so it gets the gentle anticipation curve, not
                            the static flash. */}
                        <motion.div
                          aria-hidden
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            transition: { type: "spring", stiffness: 180, damping: 14, delay: 0.12 },
                          }}
                          style={{
                            width: 44, height: 44, borderRadius: 9999,
                            background: "rgba(26,61,43,0.08)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 22,
                          }}
                        >
                          🌱
                        </motion.div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1710" }}>You're all caught up</p>
                        <p style={{ fontSize: 12, color: "#6F6860", lineHeight: "18px" }}>
                          Past notifications stay below. Full history lives in Activity.
                        </p>
                      </motion.div>
                      <button
                        type="button"
                        onClick={() => { haptic("light"); setShowRead((v) => !v); }}
                        style={{
                          width: "100%",
                          padding: "11px 22px",
                          background: "rgba(26,23,16,0.03)",
                          border: "none",
                          borderTop: "1px solid rgba(26,23,16,0.07)",
                          borderBottom: "1px solid rgba(26,23,16,0.07)",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#6F6860",
                          letterSpacing: "0.02em",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span>{showRead ? "Hide" : "Show"} {totalReadCount} past notification{totalReadCount === 1 ? "" : "s"}</span>
                        <motion.span
                          animate={{ rotate: showRead ? 180 : 0 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          style={{ display: "inline-flex", lineHeight: 0 }}
                          aria-hidden
                        >
                          <ChevronDown size={13} strokeWidth={2.4} />
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {showRead && (
                          <motion.div
                            key="read-list"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto", transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
                            exit={{ opacity: 0, height: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
                            style={{ overflow: "hidden" }}
                          >
                            {visibleRead.map((a, i) => renderRow(a, { dim: true, index: i }))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  );
                }

                // Has unread: triage view. Render unread, then optional
                // overflow link, then collapsible read section. Unread list
                // is wrapped in AnimatePresence so swipe-away / tap-through /
                // Mark-all-read each get a smooth height-collapse exit
                // instead of a hard pop.
                return (
                  <>
                    <AnimatePresence initial={false}>
                      {visibleUnread.map((a, i) => renderRow(a, { index: i }))}
                    </AnimatePresence>
                    {overflowUnread > 0 && (
                      <button
                        type="button"
                        onClick={handleViewAllInActivity}
                        // Hover/focus affordance via className. Base
                        // muted-evergreen tint deepens slightly on cursor
                        // approach — same Apple Settings register as the
                        // sidebar fund switcher button.
                        className="block w-full bg-[rgba(26,61,43,0.04)] border-0 border-t border-b border-t-[rgba(26,23,16,0.06)] border-b-[rgba(26,23,16,0.06)] text-left cursor-pointer transition-colors hover:bg-[rgba(26,61,43,0.08)] focus-visible:bg-[rgba(26,61,43,0.08)] focus-visible:outline-none"
                        style={{
                          padding: "12px 22px",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#1A3D2B",
                        }}
                      >
                        +{overflowUnread} more new · View in Activity →
                      </button>
                    )}
                    {totalReadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => { haptic("light"); setShowRead((v) => !v); }}
                        // Hover/focus tint so the affordance reads as
                        // tappable. Border-bottom appears only when expanded
                        // so the divider isn't redundant with the closed
                        // state's already-implicit top edge.
                        className={`flex w-full items-center justify-between gap-2 bg-transparent border-0 border-t border-t-[rgba(26,23,16,0.07)] text-left cursor-pointer transition-colors hover:bg-[hsl(var(--kiddo-cream))] focus-visible:bg-[hsl(var(--kiddo-cream))] focus-visible:outline-none ${showRead ? "border-b border-b-[rgba(26,23,16,0.07)]" : ""}`}
                        style={{
                          padding: "11px 22px",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#6F6860",
                          letterSpacing: "0.02em",
                        }}
                      >
                        <span>{showRead ? "Hide" : "Show"} {totalReadCount} read</span>
                        <motion.span
                          animate={{ rotate: showRead ? 180 : 0 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          style={{ display: "inline-flex", lineHeight: 0 }}
                          aria-hidden
                        >
                          <ChevronDown size={13} strokeWidth={2.4} />
                        </motion.span>
                      </button>
                    )}
                    <AnimatePresence initial={false}>
                      {showRead && (
                        <motion.div
                          key="read-list-triage"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto", transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
                          style={{ overflow: "hidden" }}
                        >
                          {visibleRead.map((a, i) => renderRow(a, { dim: true, index: i }))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                );
              })()}
            </div>

            {/* Brief undo strip — appears for ~4s after EITHER a
                swipe-mark-read OR a Mark-all-read. Lives between the list
                and the footer so it pushes the footer down on mount + lets
                it reclaim space on unmount, animated. Only ONE undo
                lifeline at a time — a newer mark-action replaces the
                previous undo target. Tap-mark-read still doesn't get one
                (panel closes + navigates → no surface to show on).
                iOS Mail / Gmail register. */}
            <AnimatePresence initial={false}>
              {recentlyMarkedRead && (
                <motion.div
                  key="undo-strip"
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{
                    background: "#1A3D2B",
                    color: "white",
                    padding: "10px 22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.92 }}>
                      {recentlyMarkedRead.kind === "all"
                        ? "All marked read"
                        : recentlyMarkedRead.kind === "one_unread"
                          ? "Marked unread"
                          : "Marked read"}
                    </span>
                    <button
                      type="button"
                      onClick={undoMarkRead}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#EDC164",
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase" as const,
                        cursor: "pointer",
                        padding: "2px 4px",
                      }}
                      data-testid="notif-undo-mark-read"
                    >
                      Undo
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer — explicit handoff to Activity (the reference layer)
                plus a smaller settings link. The Activity link gets primary
                weight because that's where parents go for completeness:
                search, filters, money math, pending, scheduled. The
                Notifications panel is the inbox; Activity is the ledger.
                Bottom padding respects safe-area-inset-bottom so the link
                never sits under the iOS home indicator.

                SCOPE-GATED: both footer links point at fund-scoped pages
                (/activity reads the active fund; /settings is the per-fund
                settings surface). On /funds (household tier) and /account
                (user tier) there's no active-fund context, so linking
                there is incoherent — same reason those pages already
                suppress AppHeader's fund trigger + Quick Links per
                project_chrome_scope_tiers.md. Hide the footer entirely on
                non-fund-scoped pages; the notifications above still
                surface, just without the dangling "go to a fund page you
                don't have context for" handoff. */}
            {!shouldSuppressFundChrome(location) && (
              <div style={{
                borderTop: "1.5px solid rgba(26,23,16,0.10)",
                paddingTop: 11,
                paddingLeft: 22,
                paddingRight: 22,
                paddingBottom: "max(11px, env(safe-area-inset-bottom, 11px))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}>
                <button
                  type="button"
                  onClick={handleViewAllInActivity}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#1A3D2B",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  data-testid="notif-view-all-activity"
                >
                  View all in Activity →
                </button>
                <Link
                  href="/settings?tab=notifications&from=notifications"
                  onClick={onClose}
                  style={{ fontSize: 11, color: "#9B9088", textDecoration: "none" }}
                >
                  Settings
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Bell badge + mobile activity-tab dot use this hook. Scopes to the active
// fund by default — matches the rest of the app (Dashboard, Memory,
// Activity all show one fund at a time). Without scoping, parents with
// multiple test funds get a "9+" badge even when the only unread items
// are stale lifecycle nudges from abandoned funds. Pass scope: "all" to
// opt out (currently no callers do; reserved for future "all funds"
// indicator if needed).
export function useNotificationUnreadCount(scope: "active" | "all" = "active"): number {
  const { isAuthenticated } = useAuth();
  const { data: activitiesRaw = [] } = useActivities(40, isAuthenticated);
  // Same gift-pair dedupe as the panel — without this, the bell badge
  // counts both `gift_received` and `gift_invested` for the same gift,
  // doubling the unread count on every new contribution.
  const activities = useMemo(
    () => dedupeGiftPairs(activitiesRaw as Activity[]),
    [activitiesRaw],
  );
  // Track the active fund id reactively so badge updates when user
  // switches funds in AppHeader's picker.
  const [activeFundId, setActiveFundIdState] = useState<string>(() => getActiveFundId());
  useEffect(() => {
    const handler = () => setActiveFundIdState(getActiveFundId());
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);
  // Action items contribute to the activity-tab dot for the same
  // reason they contribute to the bell badge: a kyc_action_required
  // todo isn't "resolved" just because the parent tapped over to
  // the Activity surface — the underlying problem persists until
  // they actually fix it. See project_action_items_architecture.
  const { data: actionItemsResponse } = useQuery<{ items: any[]; count: number }>({
    queryKey: ["/api/me/action-items"],
    queryFn: async () => {
      const res = await fetch("/api/me/action-items", { credentials: "include" });
      if (!res.ok) return { items: [], count: 0 };
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const actionItemCount = actionItemsResponse?.count ?? 0;
  // Shared subscriber — re-derives whenever any consumer (panel,
  // another tab) writes to localStorage. Without this, the badge
  // stayed stale until an unrelated re-render shook it loose.
  const { lastReadAt, readIds, unreadIds } = useNotificationReadState();
  return useMemo(() => {
    const unreadInformational = (activities as Activity[]).filter((a) => {
      if (isInternalOnlyActivity(a.type)) return false;
      // Bell-noise filter applied here too. Original intent was that the
      // tab dot was a "broad ledger" signal, but in practice that meant
      // the dot fired on the parent's OWN actions (memory edits, kid-
      // suggestion approvals) and on routine system flows (auto-invest
      // fires, subscription renewals) — none of which are "you should
      // look." User-reported: "the orange dot keeps reappearing even
      // though nothing new." It WAS new — but it was nothing the parent
      // needed to know about. Same noise-filter as the bell now keeps
      // the dot honest.
      if (isBellNoise(a.type)) return false;
      // Drop activity types now represented as Needs-your-attention
      // cards, mirroring the panel's de-dupe so the activity-tab dot
      // doesn't double-count a single problem.
      if (isRepresentedByActionItem(a.type)) return false;
      if (scope === "active" && activeFundId && a.fundId && a.fundId !== activeFundId) return false;
      // Explicit unreadIds win — a past row re-promoted to unread
      // via swipe stays in the count until either tapped (which
      // re-marks as read) or auto-marked-read on Activity-page
      // visit (markNotificationsRead clears unreadIds too).
      const idStr = String(a.id);
      if (unreadIds.has(idStr)) return true;
      if (new Date(a.createdAt!).getTime() <= lastReadAt) return false;
      if (readIds.has(idStr)) return false;
      return true;
    }).length;
    return unreadInformational + actionItemCount;
  }, [activities, activeFundId, scope, lastReadAt, readIds, unreadIds, actionItemCount]);
}

// Bell-specific unread count. Today this is functionally identical to
// useNotificationUnreadCount (both apply isBellNoise + isInternalOnlyActivity
// + dedupeGiftPairs). Kept as a separate export for two reasons:
//   1. Future divergence — if the bell ever wants to surface different
//      types than the tab dot (e.g., an "needs ACTION right now" subset),
//      this is the seam.
//   2. Call-site clarity — `useBellUnreadCount` reads obviously at the
//      bell consumer; `useNotificationUnreadCount` reads obviously at
//      the tab-dot consumer. Sharing the same name across both would
//      hide the relationship.
//
// History: previously the tab dot used the broader filter (everything
// in the ledger) on the theory that the Activity page IS the
// comprehensive view, so the dot should fire for any new ledger row.
// In practice that meant the dot fired on the parent's own actions
// and on routine system flows — items the parent had no reason to be
// pulled in for. The dot read as "nothing actionable but here's a
// reminder anyway," which is exactly what feedback_no_ai_slop bans.
// Now both surfaces share the same noise filter.
export function useBellUnreadCount(scope: "active" | "all" = "active"): number {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: activitiesRaw = [] } = useActivities(40, isAuthenticated);
  const activities = useMemo(
    () => dedupeGiftPairs(activitiesRaw as Activity[]),
    [activitiesRaw],
  );
  const [activeFundId, setActiveFundIdState] = useState<string>(() => getActiveFundId());
  useEffect(() => {
    const handler = () => setActiveFundIdState(getActiveFundId());
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);

  // Cross-fund realtime nudge. The activities query (and the fund list)
  // both contribute to the bell badge — on any new gift across any of
  // this user's funds (owned OR collaborated), invalidate both so the
  // unread count and the fund-switcher balances update without waiting
  // for the 120s activity poll. This is the surface that handles the
  // "I'm parked on Fund A and a gift just landed on Fund B" case the
  // Dashboard hook intentionally ignores.
  useRealtimeEvents((event) => {
    if (event.type === "gift.arrived" || event.type === "fund.updated") {
      void queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    }
  });

  // Open action items (kyc, ssn missing, payment failed, etc.) are
  // counted IN ADDITION to unread informational items. This is the
  // "read vs resolved" split: an action item stays in the badge
  // until the underlying problem is fixed (or the user snoozes it),
  // not just until they tapped the bell. See project_action_items
  // _architecture for why.
  //
  // Same query key as useActionItems() so the cache is shared. The
  // dedicated hook can't be reused directly here (one fewer layer
  // of useQuery saves a render); the read is from cache anyway.
  const { data: actionItemsResponse } = useQuery<{ items: any[]; count: number }>({
    queryKey: ["/api/me/action-items"],
    queryFn: async () => {
      const res = await fetch("/api/me/action-items", { credentials: "include" });
      if (!res.ok) return { items: [], count: 0 };
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const actionItemCount = actionItemsResponse?.count ?? 0;

  const { lastReadAt, readIds, unreadIds } = useNotificationReadState();
  return useMemo(() => {
    const unreadInformational = (activities as Activity[]).filter((a) => {
      if (isInternalOnlyActivity(a.type)) return false;
      if (isBellNoise(a.type)) return false;
      // Same de-dupe the panel applies. Activity rows that represent
      // open action items (KYC, SSN, payment failed, large-gift hold)
      // are surfaced as cards in the Needs-your-attention section, so
      // counting them as informational unread AS WELL would double the
      // badge for a single problem. After my fix the panel renders
      // them once; the badge needs to mirror that.
      if (isRepresentedByActionItem(a.type)) return false;
      if (scope === "active" && activeFundId && a.fundId && a.fundId !== activeFundId) return false;
      const idStr = String(a.id);
      if (unreadIds.has(idStr)) return true;
      if (new Date(a.createdAt!).getTime() <= lastReadAt) return false;
      if (readIds.has(idStr)) return false;
      return true;
    }).length;
    return unreadInformational + actionItemCount;
  }, [activities, activeFundId, scope, lastReadAt, readIds, unreadIds, actionItemCount]);
}
