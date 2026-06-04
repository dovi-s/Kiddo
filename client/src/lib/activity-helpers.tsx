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

export function parseAmount(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
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
    return { bg: "rgb(254,228,228)", color: "rgb(170,38,38)", icon: <AlertCircle size={16} />, label: "Charge failed" };
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

export function StatusPill({ status, type }: { status?: string | null; type?: string | null }) {
  let resolved = status || null;
  if (!resolved && type) {
    if (type === "parent_contribution_failed" || type === "payment_failed") resolved = "failed";
  }
  if (!resolved) return null;
  const map: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    pending:    { label: "Pending",    bg: "rgb(255,247,230)", color: "rgb(161,88,0)",   icon: <Clock size={9} /> },
    processing: { label: "Processing", bg: "rgb(232,242,255)", color: "rgb(30,80,170)",  icon: <Clock size={9} /> },
    invested:   { label: "Invested",   bg: "rgb(237,244,238)", color: "rgb(26,61,43)",   icon: <ArrowUp size={9} /> },
    settled:    { label: "Settled",    bg: "rgb(237,244,238)", color: "rgb(26,61,43)",   icon: <Check size={9} /> },
    failed:     { label: "Failed",     bg: "rgb(254,228,228)", color: "rgb(170,38,38)",  icon: <AlertCircle size={9} /> },
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
