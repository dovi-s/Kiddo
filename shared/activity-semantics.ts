// Activity semantics — the SINGLE source of truth for what an activity
// "means": its canonical user-facing LABEL, its filter CATEGORY, and the
// type-grouping arrays. Pure TS, ZERO JSX/React, so it is importable by the
// web client, the server, AND (where the type vocabulary matches) the native
// app — the same way shared/legal-copy.ts, shared/strategy.ts, and
// shared/projection.ts are the cross-surface truth modules for their domains.
//
// WHY THIS EXISTS (2026-06-03):
//   The activity label/category taxonomy had drifted into FOUR independent
//   implementations that disagreed on wording for the same event:
//     - client/src/pages/Activity.tsx        (the feed — the most complete,
//                                              ~60 types, the de-facto reference)
//     - client/src/lib/activity-helpers.tsx  (a stale subset → DetailHistoryModal
//                                              + Dashboard)
//     - client/src/pages/ActivityDetail.tsx  (a different, smaller subset → the
//                                              deep-link detail page; e.g. it
//                                              showed "Investment"/"Gift Received"
//                                              where the feed shows
//                                              "Recurring investment"/"Gift received")
//     - apps/mobile/.../ActivityTab.tsx       (crude substring matching)
//   So tapping a feed row could land you on a detail page that named the same
//   transaction differently. This module makes Activity.tsx's (reference)
//   labels canonical and lets every other surface converge UP to them.
//
// PRINCIPLE: labels here MIRROR Activity.tsx's getTypeConfig exactly (so the
// reference surface renders unchanged), with one deliberate FIX — see the
// gifter_recurring_* note below.
//
// Each label is a pure function of the activity `type` string. The reference
// surface's per-type colors and icons stay surface-local (the feed uses inline
// rgb tiles, the detail page uses HSL classes, mobile uses Ionicons, the bell
// uses emoji) — those are intentionally different visual registers and are NOT
// unified here. Only MEANING (label + category) is shared.

export function normalizeActivityType(type?: string | null): string {
  return (type || "event_update").toString();
}

// ---------------------------------------------------------------------------
// Filter category buckets — mirrors Activity.tsx. The user-facing filter pills
// are All / Gifts (gift) / Yours (auto) / Portfolio (growth) / Milestones
// (milestone). "memory"/"nudge"/"update" are internal sub-buckets that roll up
// under Milestones / hidden as appropriate on the feed.
// ---------------------------------------------------------------------------

// "Gifts" = money + lifecycle events from EXTERNAL gifters, including a
// gifter's own recurring-schedule lifecycle (those are about a gift
// relationship with someone else, not the parent's own money).
export const GIFT_TYPES = [
  "gift_received",
  "gift_invested",
  "gift_received_cash",
  "large_gift_hold_started",
  "large_gift_hold_released",
  "refund",
  "gifter_recurring_started",
  "gifter_recurring_paused",
  "gifter_recurring_resumed",
  "gifter_recurring_cancelled",
];

// "Yours" (internal value: "auto") = money + lifecycle events from the PARENT:
// their own contributions (one-time + recurring fires) and schedule actions.
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
  // Strategy + custom-mix changes are PORTFOLIO decisions, not milestones.
  // GROWTH_TYPES is checked before MILESTONE_TYPES in the mapper.
  "fund_strategy_changed",
  "custom_allocations_changed",
  // FUTURE — when real custody is live (Alpaca/DriveWealth wired), discrete
  // broker income + fee events belong HERE so the ledger stays complete:
  //   "dividend_received", "interest_accrued", "platform_fee_charged"
  // Wire createActivity at the broker reconciliation path + the AUM/fee path.
  // (NOT continuous price drift — that stays out of the ledger by design; the
  // hero + the "while you were away" digest carry aggregate growth.) Pre-custody
  // none of these flow, so there is nothing to log yet.
];

export const ENGINE_MILESTONE_TYPES = [
  "milestone_money_cross",
  "milestone_returning_gifter",
  "milestone_unique_gifters",
  "milestone_anniversary",
  "milestone_first_voice",
  "milestone_first_photo",
  "milestone_first_kid_pick_approved",
  // Earned truth: fund value reached 2x everything put in (2026-06-04).
  // Without this registration the type mis-bucketed to "update" and rendered
  // a generic Update tile (code-review catch).
  "milestone_growth_passed_gifts",
];

export const MILESTONE_TYPES = [
  ...ENGINE_MILESTONE_TYPES,
  "event_pass_purchased",
  "subscription_started", "subscription_canceled", "subscription_renewal", "payment_failed",
  "kyc_approved", "kyc_action_required", "kyc_pending_review",
  "starter_plan_activated", "family_plan_activated",
  "memory_entry_added", "memory_milestone_added",
  "memory_entry_edited", "memory_entry_deleted",
  "age16_parent_notice", "age17_memory_book_preview", "age18_handoff_ready",
  "kid_stock_suggestion",
  "kid_suggestion_approved", "kid_suggestion_declined",
  "fund_created",
  // The fund goes LIVE for investing (draft -> active, after KYC approval). A
  // distinct moment from creation — without it a fund could flip to active with
  // no ledger entry explaining when it became real. See the activate-pending-
  // drafts route.
  "fund_activated",
  "event_created", "event_archived", "event_unarchived",
  "ssn_provided",
  "successor_custodian_added", "successor_custodian_changed", "successor_custodian_removed",
  "child_profile_updated",
  "majority_state_updated",
  // Co-parent / collaborator relationship events. Were audit-logged only (never
  // surfaced in the feed) until 2026-06-07 — a parent's Activity never showed
  // "Elena joined as a co-parent." Now first-class fund events.
  "collaborator_invited", "collaborator_accepted", "collaborator_role_changed", "collaborator_removed",
];

// `upgrade_*` rows + the stale `monetization_trigger_event` literal are pure
// CTA-funnel analytics — never user-facing. Surfaces hide these.
const INTERNAL_ONLY_TYPES = ["monetization_trigger_event"];
export function isInternalOnlyType(type?: string | null): boolean {
  const t = normalizeActivityType(type);
  return INTERNAL_ONLY_TYPES.includes(t) || t.startsWith("upgrade_");
}

export type ActivityCategory = "gift" | "auto" | "growth" | "memory" | "milestone" | "nudge" | "update";

// One-time PARENT gifts ride on type=gift_received with
// metadata.isParentContribution=true; they belong in "Yours" (auto), not the
// from-others "Gifts" bucket. Mirrors Activity.tsx's isParentContributionItem.
export function isParentContributionItem(item: any): boolean {
  if (typeof item?.isParentContribution === "boolean") return item.isParentContribution;
  const raw = item?.metadata;
  if (!raw || typeof raw !== "string") return false;
  try {
    const parsed = JSON.parse(raw) as { isParentContribution?: unknown };
    return parsed.isParentContribution === true;
  } catch {
    return false;
  }
}

export function mapActivityTypeToCategory(type?: string | null): ActivityCategory {
  const t = normalizeActivityType(type);
  if (GIFT_TYPES.includes(t)) return "gift";
  if (AUTO_TYPES.includes(t)) return "auto";
  if (GROWTH_TYPES.includes(t)) return "growth";
  if (t.startsWith("lifecycle_")) return "nudge";
  if (t.startsWith("memory_") || t === "memory_entry_added") return "memory";
  if (t.startsWith("age16_") || t.startsWith("age17_") || t.startsWith("age18_")) return "milestone";
  if (MILESTONE_TYPES.includes(t)) return "milestone";
  return "update";
}

// Category for a full activity ITEM (honours the parent-contribution metadata
// flag on gift_received rows). Use this when you have the row, not just a type.
export function mapItemToCategory(item: any): ActivityCategory {
  const t = normalizeActivityType(item?.type);
  if (t === "gift_received" && isParentContributionItem(item)) return "auto";
  return mapActivityTypeToCategory(item?.type);
}

// ---------------------------------------------------------------------------
// Canonical label — the ONE user-facing string per activity type.
//
// Mirrors client/src/pages/Activity.tsx getTypeConfig (the reference) EXACTLY,
// with ONE deliberate fix: the gifter_recurring_* types are listed in
// GIFT_TYPES, so in the reference the `GIFT_TYPES.includes` short-circuit fired
// first and these rows rendered the generic "Gift received" — their dedicated
// "Gifter paused/resumed/cancelled recurring" labels were dead code. Here the
// specific cases are checked FIRST, so those rows now read correctly. This is
// the only intentional wording change; everything else is verbatim.
//
// Returns null for types with no canonical label so callers fall back to their
// own default (the feed's "Update", the detail page's title-cased type, etc.).
// ---------------------------------------------------------------------------
export function canonicalLabel(type?: string | null): string | null {
  const t = normalizeActivityType(type);

  // Gifter recurring-schedule lifecycle — checked BEFORE the gift group so the
  // specific labels win (see header note: this fixes the reference's dead-code
  // short-circuit that mislabeled these as "Gift received").
  if (t === "gifter_recurring_started") return "Gifter set up recurring";
  if (t === "gifter_recurring_paused") return "Gifter paused recurring";
  if (t === "gifter_recurring_resumed") return "Gifter resumed recurring";
  if (t === "gifter_recurring_cancelled") return "Gifter cancelled recurring";

  // Gift family
  if (t === "refund") return "Refund";
  if (t === "large_gift_hold_started") return "Gift on hold";
  if (t === "large_gift_hold_released") return "Gift released";
  if (t === "gift_received_cash") return "Gift held as cash";
  if (t === "gift_invested") return "Gift invested";
  if (t === "gift_received" || t === "first_gift_received") return "Gift received";

  // Parent recurring / contributions
  if (t === "recurring_paused") return "Recurring paused";
  if (t === "recurring_resumed") return "Recurring resumed";
  if (t === "auto_invest") return "Recurring investment";
  if (t === "parent_contribution") return "Contribution";
  // Eyebrow is the CATEGORY (matches the successful "Recurring investment" row); the
  // "Failed" status lives on the pill. Was "Charge failed," which stacked with the pill
  // AND a "Recurring investment failed" title = the word three times (founder catch 2026-07).
  if (t === "parent_contribution_failed") return "Recurring investment";
  if (t === "recurring_request") return "Recurring request";

  // Co-parent / collaborator
  if (t === "collaborator_invited") return "Co-parent invited";
  if (t === "collaborator_accepted") return "Co-parent joined";
  if (t === "collaborator_role_changed") return "Co-parent role changed";
  if (t === "collaborator_removed") return "Co-parent removed";

  // Sealed letters + sponsor-Plus
  if (t === "sealed_letter_delivered") return "Sealed letter delivered";
  if (t === "sponsor_plus_activated") return "Plus sponsored";
  if (t === "sponsor_renewal_reminder_sent") return "Renewal reminder";
  if (t === "sponsor_plus_refunded") return "Plus refunded";
  if (t === "sponsor_plus_expired") return "Plus ended";

  // Memory family
  if (t === "memory_milestone_added") return "Milestone";
  if (t === "memory_entry_added") return "Memory added";
  if (t === "memory_entry_edited") return "Memory edited";
  if (t === "memory_entry_deleted") return "Memory deleted";
  // Guestbook: a no-payment note left from the public occasion page
  // (note-first event CTA, 2026-06-04). Lands pending parent review.
  if (t === "memory_guestbook_note") return "Note left";
  if (t.startsWith("memory_")) return "Memory Book";

  // Growth / portfolio
  if (t === "bank_unlinked") return "Bank removed";
  if (t === "bank_linked") return "Bank linked";
  if (t === "sell") return "Portfolio";
  if (t === "withdrawal") return "Withdrawal";
  if (t === "cash_invested") return "Cash invested";

  // Account / fund decisions
  if (t === "fund_created") return "Fund created";
  if (t === "fund_activated") return "Fund active";
  if (t === "fund_strategy_changed") return "Strategy";
  if (t === "custom_allocations_changed") return "Custom mix";
  if (t === "event_created") return "Occasion";
  if (t === "event_archived") return "Archived";
  if (t === "event_unarchived") return "Reopened";
  if (t === "ssn_provided") return "Tax ID";
  if (t.startsWith("successor_custodian_")) return "Successor custodian";
  if (t === "child_profile_updated") return "Profile";
  if (t === "majority_state_updated") return "Age of majority";
  if (t === "kid_stock_suggestion") return "Kid suggestion";
  if (t === "kid_suggestion_approved") return "Approved";
  if (t === "kid_suggestion_declined") return "Declined";

  // KYC / compliance
  if (t === "kyc_approved") return "Identity verified";
  if (t === "kyc_action_required") return "Identity action needed";
  if (t === "kyc_pending_review") return "Identity review";

  // Subscription / billing
  if (t === "subscription_started" || t === "starter_plan_activated" || t === "family_plan_activated") return "Subscription";
  if (t === "event_pass_purchased") return "Occasion pass";
  if (t === "subscription_renewal") return "Renewed";
  if (t === "subscription_canceled") return "Subscription ended";
  if (t === "payment_failed") return "Payment failed";

  // Milestones engine
  if (t === "milestone_money_cross") return "Milestone";
  if (t === "milestone_returning_gifter") return "Returning gifter";
  if (t === "milestone_unique_gifters") return "Community";
  if (t === "milestone_anniversary") return "Anniversary";
  if (t === "milestone_first_voice") return "First voice";
  if (t === "milestone_first_photo") return "First photo";
  if (t === "milestone_first_kid_pick_approved") return "First pick";
  if (t === "milestone_growth_passed_gifts") return "Milestone";

  // Age-phase milestones (state-agnostic labels; internal strings keep age*_)
  if (t === "age18_child_claimed" || t === "age18_handoff_completed_child") return "Fund handed off";
  if (t === "age18_handoff_completed_parent") return "Handoff complete";
  if (t === "age18_handoff_requested") return "Handoff requested";
  if (t === "age18_invite_prepared") return "Ownership invite";
  if (t === "age18_preview_prepared" || t === "age17_memory_book_preview") return "Memory Book preview";
  if (t === "age16_parent_notice" || t === "age18_handoff_ready") return "Age milestone";

  // Lifecycle nudges
  if (t.startsWith("lifecycle_")) return "Nudge";

  return null;
}
