// Shared helpers for rendering activity rows. Used by both the main Activity
// page and the DetailHistoryModal so a row's icon / status pill / reconcile
// box / receipt chip stays consistent across surfaces. Previously these were
// defined inline in Activity.tsx; extracted when the per-schedule + per-
// contributions detail modal landed and started rendering the same row shape.

import type { Activity as ActivityType } from "@shared/schema";
import { Gift, TrendingUp, Calendar, Check, Clock, ArrowUp, BookOpen, BellRing, Repeat, Star, Pause, Play, X as XIcon, Settings, CreditCard, Sliders, ShieldCheck, UserCheck, Building2, Sprout, FileText, AlertCircle } from "lucide-react";
import { canonicalLabel } from "@shared/activity-semantics";

export type FeedActivity = ActivityType & {
  fundName?: string | null;
  recipientFirstName?: string | null;
  status?: string | null;
};

export const GIFT_TYPES = [
  "gift_received",
  "gift_invested",
  "gift_received_cash",
  "large_gift_hold_started",
  "large_gift_hold_released",
  "refund",
  "gifter_recurring_paused",
  "gifter_recurring_resumed",
  "gifter_recurring_cancelled",
];

export const AUTO_TYPES = [
  "auto_invest",
  "parent_contribution",
  "parent_contribution_failed",
  "recurring_paused",
  "recurring_resumed",
];

export const GROWTH_TYPES = [
  "sell",
  "withdrawal",
  "bank_linked",
  "bank_unlinked",
  "cash_invested",
];

export function normalizeActivityType(type?: string | null): string {
  return (type || "event_update").toString();
}

export function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "string") return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

export function extractTicker(meta: Record<string, unknown>, title?: string | null): string | null {
  if (meta.ticker && typeof meta.ticker === "string") return meta.ticker.toUpperCase();
  // Recurring (auto_invest) rows stamp the pick under `selectedTicker`, not
  // `ticker` — read it too so those rows get the brand logo like gifts do.
  if (meta.selectedTicker && typeof meta.selectedTicker === "string") return meta.selectedTicker.toUpperCase();
  const text = title || "";
  const m = text.match(/^([A-Z]{1,5})\s+gift/i) || text.match(/into\s+([A-Z]{1,5})\b/i);
  return m ? m[1].toUpperCase() : null;
}

export function parseSafeDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// Drops the robotic ".00" on whole-dollar amounts ($25 not $25.00) while keeping
// real cents. Shared so the activity subsystem (DetailHistoryModal, the feed,
// the contribution detail) reads like the rest of the app instead of a ledger.
// Mirrors the per-page copies in Dashboard/MemoryBook.
export function formatMoneyFriendly(value: number): string {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function parseAmount(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

// Display-time cleanup of legacy/seed activity descriptions. Copy of the feed's
// canonical rewriteLegacyDescription (Activity.tsx) so the DetailHistoryModal +
// Dashboard render the SAME cleaned copy the feed does — without it, this surface
// showed raw seed text ("Last automatic charge could not run. Next attempt Aug 3.
// We sent you an email reminder…") while the feed showed the honest short version.
// Keep in sync with Activity.tsx (it's the reference; this converges up to it).
export function rewriteLegacyDescription(d: string | null | undefined): string | null {
  if (!d) return d ?? null;
  const t = d.trim();
  if (t === "No note." || /^\$[\d,]+(\.\d{2})? gift received$/i.test(t)) return null;
  let out = d;
  out = out.replace(/\bacross 1 positions\b/g, "across 1 position");
  out = out.replace(/(\d+)\.(\d{1,4})\s+shares?\b/g, (_m, whole: string, frac: string) => {
    const trimmed = frac.replace(/0+$/, "");
    if (trimmed === "") return whole === "1" ? `${whole} share` : `${whole} shares`;
    return `${whole}.${trimmed} shares`;
  });
  out = out.replace(/\b1-2 business days\b/g, "1 to 2 business days");
  out = out.replace(/\b1\s*-\s*2 business days\b/g, "1 to 2 business days");
  out = out.replace(/\bthe full mix\b/g, "the diversified mix");
  out = out.replace(/^Last automatic charge could not run\.\s*/, "");
  out = out.replace(/Next attempt (\w+\.? \d+)\.?/i, "Your plan is still on and charges again $1.");
  out = out.replace(/We sent you an email reminder so you can add it manually\./, "Add the missed one if you'd like.");
  return out;
}

// Configures the row's icon tile (background, color, icon) for a given
// activity type. The LABEL returned here is a legacy fallback only — the
// exported getTypeConfig wrapper below overrides it with the shared canonical
// label so this surface (DetailHistoryModal + Dashboard) names every event
// identically to the Activity feed and the deep-link detail page.
function resolveTypeVisual(type?: string | null): { bg: string; color: string; icon: React.ReactNode; label: string } {
  const t = normalizeActivityType(type);
  if (t === "refund")
    return { bg: "rgb(254,242,242)", color: "rgb(185,28,28)", icon: <ArrowUp size={16} style={{ transform: "rotate(180deg)" }} />, label: "Refund" };
  if (t === "large_gift_hold_started")
    return { bg: "rgb(255,247,230)", color: "rgb(184,121,26)", icon: <Clock size={16} />, label: "Gift on hold" };
  if (t === "large_gift_hold_released")
    return { bg: "rgb(237,244,238)", color: "rgb(26,61,43)", icon: <Gift size={16} />, label: "Gift released" };
  if (t === "gift_received_cash")
    return { bg: "rgb(237,244,238)", color: "rgb(26,61,43)", icon: <Gift size={16} />, label: "Gift held as cash" };
  // Gifter recurring-schedule lifecycle — checked before the GIFT_TYPES group
  // (these are members of GIFT_TYPES) so they get the pause/resume/cancel tile,
  // not the generic gift tile. Mirrors Activity.tsx resolveTypeVisual.
  if (t === "gifter_recurring_paused")
    return { bg: "rgb(255,247,230)", color: "rgb(184,121,26)", icon: <Pause size={16} />, label: "Gifter paused recurring" };
  if (t === "gifter_recurring_resumed")
    return { bg: "rgb(224,237,227)", color: "rgb(43,88,64)", icon: <Play size={16} />, label: "Gifter resumed recurring" };
  if (t === "gifter_recurring_cancelled")
    return { bg: "rgb(254,242,242)", color: "rgb(185,28,28)", icon: <XIcon size={16} />, label: "Gifter cancelled recurring" };
  if (GIFT_TYPES.includes(t))
    return { bg: "rgb(237,244,238)", color: "rgb(26,61,43)", icon: <Gift size={16} />, label: t === "gift_invested" ? "Gift invested" : "Gift received" };
  if (t === "recurring_paused")
    return { bg: "rgb(255,247,230)", color: "rgb(184,121,26)", icon: <Pause size={16} />, label: "Recurring paused" };
  if (t === "recurring_resumed")
    return { bg: "rgb(224,237,227)", color: "rgb(43,88,64)", icon: <Play size={16} />, label: "Recurring resumed" };
  if (t === "auto_invest")
    return { bg: "rgb(224,237,227)", color: "rgb(43,88,64)", icon: <Repeat size={16} />, label: "Recurring investment" };
  if (t === "parent_contribution")
    return { bg: "rgb(224,237,227)", color: "rgb(43,88,64)", icon: <Repeat size={16} />, label: "Contribution" };
  if (t === "parent_contribution_failed")
    // A recurring auto-invest charge that couldn't run is a RECOVERABLE hiccup —
    // the schedule lives (the NEXT charge proceeds) but the missed one needs the
    // parent to add it manually (the worker does NOT re-run it) — so it wears the
    // calm amber "Needs you" frame (matching the dashboard card), NOT an alarming
    // red "Failed". "Needs you" (not "Retrying") because nothing auto-retries the
    // missed charge; it pairs with the "Add it now" action. Label = category
    // ("Recurring investment"); the "Needs you" pill carries the status.
    return { bg: "rgb(255,247,230)", color: "rgb(161,88,0)", icon: <AlertCircle size={16} />, label: "Recurring investment" };
  if (t === "memory_milestone_added")
    return { bg: "rgb(253,248,236)", color: "rgb(122,92,30)", icon: <Star size={16} />, label: "Milestone" };
  if (t === "memory_entry_edited")
    return { bg: "rgb(245,237,253)", color: "rgb(126,68,180)", icon: <FileText size={16} />, label: "Memory edited" };
  if (t === "memory_entry_deleted")
    return { bg: "rgb(254,242,242)", color: "rgb(185,28,28)", icon: <XIcon size={16} />, label: "Memory deleted" };
  if (t.startsWith("memory_"))
    return { bg: "rgb(245,237,253)", color: "rgb(126,68,180)", icon: <BookOpen size={16} />, label: "Memory Book" };
  if (t === "bank_unlinked")
    return { bg: "rgb(254,242,242)", color: "rgb(185,28,28)", icon: <Building2 size={16} />, label: "Bank removed" };
  if (t === "bank_linked")
    return { bg: "rgb(232,242,255)", color: "rgb(30,80,170)", icon: <Building2 size={16} />, label: "Bank linked" };
  if (GROWTH_TYPES.includes(t))
    return { bg: "rgb(232,242,255)", color: "rgb(30,80,170)", icon: <TrendingUp size={16} />, label: t === "sell" ? "Portfolio" : t === "withdrawal" ? "Withdrawal" : "Growth" };
  if (t === "fund_created")
    return { bg: "rgb(237,244,238)", color: "rgb(26,61,43)", icon: <Sprout size={16} />, label: "Fund created" };
  if (t === "fund_strategy_changed")
    return { bg: "rgb(245,237,253)", color: "rgb(126,68,180)", icon: <Sliders size={16} />, label: "Strategy" };
  if (t === "ssn_provided")
    return { bg: "rgb(232,242,255)", color: "rgb(30,80,170)", icon: <ShieldCheck size={16} />, label: "Tax ID" };
  if (t.startsWith("successor_custodian_"))
    return { bg: "rgb(232,242,255)", color: "rgb(30,80,170)", icon: <UserCheck size={16} />, label: "Successor custodian" };
  if (t === "subscription_started" || t === "starter_plan_activated" || t === "family_plan_activated")
    return { bg: "rgb(245,237,253)", color: "rgb(126,68,180)", icon: <CreditCard size={16} />, label: "Subscription" };
  if (t === "subscription_renewal")
    return { bg: "rgb(245,237,253)", color: "rgb(126,68,180)", icon: <Repeat size={16} />, label: "Renewed" };
  if (t === "subscription_canceled")
    return { bg: "rgb(243,240,236)", color: "rgb(100,90,80)", icon: <XIcon size={16} />, label: "Subscription ended" };
  if (t === "payment_failed")
    return { bg: "rgb(254,228,228)", color: "rgb(170,38,38)", icon: <AlertCircle size={16} />, label: "Payment failed" };
  return { bg: "rgb(232,242,255)", color: "rgb(30,80,170)", icon: <Calendar size={16} />, label: "Update" };
}

// Public accessor — visual from resolveTypeVisual, LABEL from the shared
// canonical source so DetailHistoryModal + Dashboard rows match the Activity
// feed and the detail page word-for-word. See shared/activity-semantics.ts.
export function getTypeConfig(type?: string | null): { bg: string; color: string; icon: React.ReactNode; label: string } {
  const v = resolveTypeVisual(type);
  return { ...v, label: canonicalLabel(type) ?? v.label };
}

// Shared display-time normalizers so EVERY surface (the main feed AND the
// /activity/:id detail page) reads the same honest copy for legacy/seeded rows,
// instead of only the feed getting cleaned. Kept minimal + focused on the
// failed-charge state (the stored copy that predated the honest rewrite). The
// main feed still has its own richer rewrite; this is the shared subset.
export function normalizeActivityTitle(title?: string | null): string | null {
  if (!title) return title ?? null;
  // "Recurring investment failed" tripled the eyebrow + the status pill.
  if (title.trim() === "Recurring investment failed") return "Automatic charge didn't go through";
  return title;
}

export function normalizeActivityDescription(desc?: string | null): string | null {
  if (!desc) return desc ?? null;
  let out = desc;
  // Stale failed-charge body: restated the title, promised a false "Next attempt"
  // (nothing re-runs), and trailed a wordy email line. Make it honest + calm.
  out = out.replace(/^Last automatic charge could not run\.\s*/, "");
  out = out.replace(/Next attempt (\w+\.? \d+)\.?/i, "Your plan is still on and charges again $1.");
  out = out.replace(/We sent you an email reminder so you can add it manually\./, "Add the missed one if you'd like.");
  return out;
}

export function StatusPill({ status, type }: { status?: string | null; type?: string | null }) {
  let resolved = status || null;
  if (!resolved && type) {
    // A recurring auto-invest decline is NOT retried and does NOT break the plan
    // (it charges again next cycle); the parent can optionally add the missed one.
    // So the honest state is "Charge missed" -> calm amber, not "Retrying" (a lie:
    // nothing re-runs) and not "Needs you" (overstated: the plan self-continues).
    // A subscription payment failure is more serious (plan lapses) -> red "Failed".
    if (type === "parent_contribution_failed") resolved = "retrying";
    else if (type === "payment_failed") resolved = "failed";
  }
  if (!resolved) return null;
  const map: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    pending:    { label: "Pending",    bg: "rgb(255,247,230)", color: "rgb(161,88,0)",   icon: <Clock size={9} /> },
    processing: { label: "Processing", bg: "rgb(232,242,255)", color: "rgb(30,80,170)",  icon: <Clock size={9} /> },
    invested:   { label: "Invested",   bg: "rgb(237,244,238)", color: "rgb(26,61,43)",   icon: <ArrowUp size={9} /> },
    settled:    { label: "Settled",    bg: "rgb(237,244,238)", color: "rgb(26,61,43)",   icon: <Check size={9} /> },
    failed:     { label: "Failed",     bg: "rgb(254,228,228)", color: "rgb(170,38,38)",  icon: <AlertCircle size={9} /> },
    retrying:   { label: "Charge missed", bg: "rgb(255,247,230)", color: "rgb(161,88,0)", icon: <AlertCircle size={9} /> },
    refunded:   { label: "Refunded",   bg: "rgb(245,245,245)", color: "rgb(100,92,86)",  icon: <Clock size={9} /> },
    host_hold:  { label: "On hold",    bg: "rgb(255,247,230)", color: "rgb(161,88,0)",   icon: <Clock size={9} /> },
  };
  const m = map[resolved];
  if (!m) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 9.5, fontWeight: 700,
      background: m.bg, color: m.color,
      borderRadius: 999, padding: "2px 6px",
    }}>
      {m.icon}{m.label}
    </span>
  );
}

// Whether a row is a parent-paid type — the set that should show the
// reconcile mini-card (payment method, descriptor, retry date) in the
// expanded view, AND the set the per-schedule modal filters on.
export function isParentPaidType(type?: string | null): boolean {
  const t = normalizeActivityType(type);
  return (
    t === "parent_contribution" ||
    t === "parent_contribution_failed" ||
    t === "subscription_renewal" ||
    t === "subscription_started" ||
    t === "starter_plan_activated" ||
    t === "family_plan_activated" ||
    t === "payment_failed" ||
    t === "refund"
  );
}

// Whether a row qualifies for the "Report an issue" pre-filled support flow.
// Money-flow rows where a dispute could realistically apply.
export const REPORTABLE_TYPES = new Set([
  "gift_received", "gift_invested", "gift_received_cash",
  "parent_contribution", "parent_contribution_failed",
  "auto_invest", "cash_invested", "withdrawal",
  "subscription_renewal", "subscription_started", "payment_failed",
  "starter_plan_activated", "family_plan_activated",
  "refund",
]);

// Builds the pre-filled mailto: link for the "Report an issue" chip on a
// row. Subject/body include enough detail for support to look up the
// transaction without the parent having to dig for IDs.
export function buildReportIssueHref(opts: {
  activityId?: string | null;
  fundId?: string | null;
  type: string;
  title?: string | null;
  amount?: number | null;
  createdAt?: Date | null;
}): string {
  const dateLabel = opts.createdAt
    ? opts.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "(date unavailable)";
  const amtLabel = opts.amount != null ? `$${opts.amount.toFixed(2)}` : "(amount unavailable)";
  const subject = `Issue with transaction · ${opts.title || opts.type} · ${amtLabel}`;
  const body = [
    `Hi Kiddo team,`,
    ``,
    `I have a question about this transaction:`,
    ``,
    `Type: ${opts.title || opts.type}`,
    `Amount: ${amtLabel}`,
    `Date: ${dateLabel}`,
    `Activity ID: ${opts.activityId || "(unknown)"}`,
    opts.fundId ? `Fund ID: ${opts.fundId}` : "",
    `What happened: `,
    ``,
  ].filter(Boolean).join("\n");
  return `mailto:support@kiddofund.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
