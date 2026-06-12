import { Fragment, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch, Link } from "wouter";
// Sparkles dropped 2026-05-12 — banned per feedback_no_ai_slop.md. The three
// row-types it was used for (Kid suggestion / Subscription / Age-18 invite)
// now use semantically-correct icons: Lightbulb (gentle nudge), CreditCard
// (billing event), Mail (invitation).
import { Gift, TrendingUp, Calendar, Check, Clock, ArrowUp, ChevronDown, BookOpen, BellRing, Repeat, Star, Search, Pause, Play, Crown, X as XIcon, Settings, Lightbulb, CreditCard, Mail, Sliders, ShieldCheck, UserCheck, Building2, Sprout, FileText, AlertCircle, History } from "lucide-react";
import { DetailHistoryModal, type DetailStat, type DetailScheduledRow } from "@/components/DetailHistoryModal";
import {
  canonicalLabel,
  GIFT_TYPES,
  GROWTH_TYPES,
  normalizeActivityType,
  isInternalOnlyType,
  mapItemToCategory,
} from "@shared/activity-semantics";
import { StatusPill } from "@/lib/activity-helpers";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { STRATEGY_SHORT, STRATEGY_EMOJI } from "@/lib/strategy";
import { cashAfterLabel, rewriteSettlementSentence } from "@/lib/cash-settlement";
import { AppHeader } from "@/components/layout/AppHeader";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { EnlighteningReveal } from "@/components/ui/gemini";
import { useCachedFirstNumber } from "@/hooks/use-cached-first-number";
import { useActivities, useFundActivities } from "@/hooks/use-activities";
import { markNotificationsRead, getLastReadAt } from "@/components/NotificationsPanel";
import { LOCAL_CACHE_KEYS, readLocalCache } from "@/lib/local-cache";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getActiveFundId, ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import { useFunds } from "@/hooks/use-funds";
import { prefetchDashboard, prefetchMemoryBook, onIdle } from "@/lib/prefetch";
import { scrollToFirstMatchingTestId } from "@/lib/scroll-to-element";
import { getDeepLinkHighlightStyle } from "@/lib/deep-link-highlight";
import { MOTION } from "@/lib/motion";
import { KiddoSkeleton } from "@/components/ui/skeleton";
import { StockLogo } from "@/components/ui/stock-logo";
import { GiftSourceChip } from "@/components/GiftSourceChip";
import { ActionItemList } from "@/components/ActionItemCard";
import { useActionItems } from "@/hooks/use-action-items";
import type { Activity as ActivityType } from "@shared/schema";

// Three-tab mental model: past / present / future. The user-facing Activity surface always
// lives at one of these three.
type ActivityTab = "history" | "pending" | "scheduled";

// "Pending" splits into two visually-distinguished sections: gifts already in transit (T+2
// settling) and parent contributions whose next run is within this many days. Acorns blends
// these in one tab too — same "this is happening soon" mental model.
const PENDING_UPCOMING_DAYS = 3;

type FilterType = "all" | "gifts" | "auto" | "growth";
type FeedActivity = ActivityType & {
  fundName?: string | null;
  recipientFirstName?: string | null;
  status?: string | null;
  // Server-enriched (2026-05-19). Populated when the activity's
  // metadata carries an eventId AND the linked event still resolves.
  // Drives the gift-source chip in the meta row; null/undefined means
  // the implicit-default main-gift-page path (no chip).
  eventName?: string | null;
};

// Internal `value` keys stay (URL deep-links + analytics depend on them).
// Only user-facing labels flip. Taxonomy is parent-mental-model based:
//   Gifts      = money + lifecycle from OTHERS (external gifters)
//   Yours      = money + lifecycle from YOU (parent contributions, schedule
//                actions). Was "Auto" → "Recurring" → now "Yours" because
//                "Recurring" was overloaded — it lumped one-time parent
//                contributions in with recurring schedule events. "Yours"
//                cleanly answers "what did I do?" regardless of cadence,
//                and matches the "Contribution" row label rendered for
//                parent_contribution rows.
//   Growth     = portfolio mechanics (sells, withdrawals, banks)
//   Milestones = lifecycle, account state, KYC, age phases, memory
const filterOptions: { value: FilterType; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "gifts",      label: "Gifts" },
  { value: "auto",       label: "Yours" },
  // "Growth" was a misnomer — sells, withdrawals, and bank events are
  // portfolio mechanics, not growth (real growth = market gains, which
  // we don't surface as standalone rows). The bucket internal value
  // stays "growth" for URL/analytics stability; only the user-facing
  // pill label changes. Matches the per-row "Portfolio" label that
  // already renders for sell rows below.
  { value: "growth",     label: "Portfolio" },
];

// Filter category mapping + type-bucket arrays + normalizeActivityType +
// isInternalOnlyType now live in shared/activity-semantics.ts (the single
// source of truth, locked by script/test-activity-semantics.ts) and are
// imported above. They used to be defined inline here and were the canonical
// copy; they were moved to shared so the deep-link detail page, the
// detail-history modal, and the native app all bucket/label events the same
// way this feed does. GIFT_TYPES + GROWTH_TYPES are imported for the
// resolveTypeVisual color/icon branches; mapItemToCategory + isInternalOnlyType
// for the feed's filter pills and summary math.

// Named semantic palette for activity-row pills. Extracted 2026-05-25
// from the inline rgb() literals previously scattered through every
// branch of getTypeConfig. Each row category now picks from this
// palette instead of inventing a new rgb pair — the team-audit
// visual specialist's #1 finding ("colors are designed in DevTools,
// not in Figma") in concrete form.
//
// Why named tuples and not CSS variables / tailwind tokens:
//   - The activity-row pill is inline-styled (not via className) so
//     the dynamic per-type bg/color need to be runtime values, not
//     compile-time class lookups. Named constants are the smallest
//     change that delivers single-source-of-truth without rewriting
//     the rendering layer.
//   - The rgb() literals are preserved verbatim so this refactor
//     ships with ZERO visual change. Any future brand-color sweep
//     updates this object, and every consuming branch picks up
//     the new value automatically.
//
// Categories:
//   - GIFT       — light green, warm. Gifts received / invested / released.
//   - RECURRING  — sage green, slightly darker. Recurring auto-invest active.
//   - GROWTH     — soft blue, financial movement (sells, withdrawals, bank).
//   - MEMORY     — soft purple, kid-domain story (memory entries, suggestions).
//   - CELEBRATION_GOLD — warm gold, gift-moment iconography (sponsor-Plus
//                       activation, sealed letter delivered).
//   - MILESTONE_GOLD   — saturated gold, milestones engine (money-cross,
//                       anniversary, first photo). Same family as celebration
//                       gold but the text-color skews deeper for engine rows.
//   - SUBTLE_CREAM     — paper-tone background, milestone "soft" variants.
//   - ALERT_DESTRUCTIVE — light red, undoing actions (refund, cancellation,
//                        deletion).
//   - ALERT_FAILED      — saturated red, hard failure (payment failed,
//                        charge declined).
//   - WARNING           — light amber, paused / on-hold / needs-action.
//   - NEUTRAL_MUTED     — desaturated brown-gray, ended / archived / quiet
//                        completion (sponsor expired, subscription canceled).
const PALETTE = {
  GIFT:              { bg: "rgb(237,244,238)", color: "rgb(26,61,43)"   },
  // True SAGE — a muted, grayer green, deliberately distinct from the deep
  // evergreen GIFT palette above. Was rgb(43,88,64): a saturated forest green
  // a hair off GIFT's rgb(26,61,43), so "your contribution" and "gift from
  // others" read as the same color. The "sage palette (parent ongoing action)"
  // the code always intended now actually looks sage. 2026-06-01.
  RECURRING:         { bg: "rgb(234,239,233)", color: "rgb(96,124,104)" },
  GROWTH:            { bg: "rgb(232,242,255)", color: "rgb(30,80,170)"  },
  MEMORY:            { bg: "rgb(245,237,253)", color: "rgb(126,68,180)" },
  CELEBRATION_GOLD:  { bg: "rgb(253,248,236)", color: "rgb(122,92,30)"  },
  MILESTONE_GOLD:    { bg: "rgb(255,247,230)", color: "rgb(146,108,46)" },
  SUBTLE_CREAM:      { bg: "rgb(253,250,243)", color: "rgb(146,108,46)" },
  ALERT_DESTRUCTIVE: { bg: "rgb(254,242,242)", color: "rgb(185,28,28)"  },
  ALERT_FAILED:      { bg: "rgb(254,228,228)", color: "rgb(170,38,38)"  },
  WARNING:           { bg: "rgb(255,247,230)", color: "rgb(184,121,26)" },
  NEUTRAL_MUTED:     { bg: "rgb(243,240,236)", color: "rgb(100,90,80)"  },
  // Gift-status pill family — used by StatusPill, distinct from the
  // activity-event palettes above. Pending/host-hold use a deeper
  // amber text than WARNING (rgb 161,88,0 vs 184,121,26) for the
  // pill-size legibility. Refunded uses a desaturated gray that
  // doesn't appear elsewhere.
  PILL_PENDING:      { bg: "rgb(255,247,230)", color: "rgb(161,88,0)"   },
  PILL_REFUNDED:     { bg: "rgb(245,245,245)", color: "rgb(100,92,86)"  },
} as const;

// Visual config (background, text color, icon) per activity type. The LABEL
// returned here is the legacy inline value, kept ONLY as a fallback — the
// public getTypeConfig wrapper below overrides it with the shared canonical
// label so the feed, the detail page, the modal, and the dashboard all name
// the same event identically. See shared/activity-semantics.ts.
function resolveTypeVisual(type?: string | null): { bg: string; color: string; icon: React.ReactNode; label: string } {
  const t = normalizeActivityType(type);
  // Gift family — green palette (kid-domain warmth)
  if (t === "refund")
    return { ...PALETTE.ALERT_DESTRUCTIVE, icon: <ArrowUp size={16} style={{ transform: "rotate(180deg)" }} />, label: "Refund" };
  if (t === "large_gift_hold_started")
    return { ...PALETTE.WARNING, icon: <Clock size={16} />, label: "Gift on hold" };
  if (t === "large_gift_hold_released")
    return { ...PALETTE.GIFT, icon: <Gift size={16} />, label: "Gift released" };
  if (t === "gift_received_cash")
    return { ...PALETTE.GIFT, icon: <Gift size={16} />, label: "Gift held as cash" };
  // Gifter recurring-schedule lifecycle — checked BEFORE the GIFT_TYPES group
  // because these are MEMBERS of GIFT_TYPES (they bucket into the Gifts filter)
  // yet must NOT inherit the generic gift tile. Previously they sat AFTER the
  // GIFT_TYPES.includes short-circuit below, so a paused/resumed/cancelled
  // gifter schedule rendered as a green "Gift received" tile (label was also
  // wrong until the shared canonical layer landed). Now they get the
  // pause/resume/cancel treatment they were always meant to have.
  if (t === "gifter_recurring_paused")
    return { ...PALETTE.WARNING, icon: <Pause size={16} />, label: "Gifter paused recurring" };
  if (t === "gifter_recurring_resumed")
    return { ...PALETTE.RECURRING, icon: <Play size={16} />, label: "Gifter resumed recurring" };
  if (t === "gifter_recurring_cancelled")
    return { ...PALETTE.ALERT_DESTRUCTIVE, icon: <XIcon size={16} />, label: "Gifter cancelled recurring" };
  if (GIFT_TYPES.includes(t))
    return { ...PALETTE.GIFT, icon: <Gift size={16} />, label: t === "gift_invested" ? "Gift invested" : "Gift received" };
  // Auto / recurring family — sage palette (parent ongoing action)
  if (t === "recurring_paused")
    return { ...PALETTE.WARNING, icon: <Pause size={16} />, label: "Recurring paused" };
  if (t === "recurring_resumed")
    return { ...PALETTE.RECURRING, icon: <Play size={16} />, label: "Recurring resumed" };
  if (t === "auto_invest")
    return { ...PALETTE.RECURRING, icon: <Repeat size={16} />, label: "Recurring investment" };
  if (t === "parent_contribution")
    return { ...PALETTE.RECURRING, icon: <Repeat size={16} />, label: "Contribution" };
  // Pricing-v3 (locked 2026-05-23): a gifter on a Free fund used the
  // "ask the family to enable monthly contributions" CTA in
  // GiftCheckout. This activity row IS the relationship signal; the
  // dashboard surfaces an aggregated "X gifters want to give monthly"
  // nudge separately for the conversion moment. Green palette signals
  // "this is a positive event" (someone loves your kid enough to want
  // to give monthly), BellRing icon signals "you got a request to
  // respond to." See project_pricing_v3_recurring_at_plus.md design
  // constraint #4 (feature-request flow, not paywall pressure).
  if (t === "recurring_request")
    return { ...PALETTE.GIFT, icon: <BellRing size={16} />, label: "Recurring request" };
  // Sealed-letter delivery (Prong B Phase 6, locked 2026-05-23). The
  // sealedLetterDeliveryWorker writes this row when a sealed letter's
  // deliver_at fires. Warm gold palette matches the Memory Book story
  // category (ceremonial moment, not transactional). BookOpen icon
  // signals "a story moment just opened." See
  // project_sealed_letters_implementation_plan.md Phase 6.
  if (t === "sealed_letter_delivered")
    return { ...PALETTE.CELEBRATION_GOLD, icon: <BookOpen size={16} />, label: "Sealed letter delivered" };
  // Sponsor-Plus activation (Prong B of pricing-v3 conversion, locked
  // 2026-05-23). The handleSponsorPlusPurchase webhook writes this
  // when a gifter sponsors a year of Plus/Family for the fund. Warm
  // gold palette signals "this is a gift moment" (matches the gift-
  // family treatment but distinct enough to read as the upgrade
  // moment, not a deposit). Sparkles icon signals "something opened
  // up on this fund." See project_gifter_sponsors_plus_subscription.md.
  if (t === "sponsor_plus_activated")
    return { ...PALETTE.CELEBRATION_GOLD, icon: <Crown size={16} />, label: "Plus sponsored" };
  // Sponsor-Plus renewal reminder sent (shipped 2026-05-23 same-day as
  // MVP). Quieter palette than the activation moment — it's a beat,
  // not a celebration. Mail icon signals "we sent you a thing." See
  // sponsoredSubscriptionRenewalWorker.ts + the locked spec.
  if (t === "sponsor_renewal_reminder_sent")
    return { ...PALETTE.NEUTRAL_MUTED, icon: <Mail size={16} />, label: "Renewal reminder" };
  // Sponsor-Plus refunded — Stripe sent us a charge.refunded event
  // and we flipped the sponsored sub to status='refunded'. Coverage
  // is rolled back; parent gets the activity row + (eventually) email.
  // Muted red palette signals "this is undoing something." Per the
  // handleChargeRefunded extension shipped 2026-05-23.
  if (t === "sponsor_plus_refunded")
    return { ...PALETTE.ALERT_DESTRUCTIVE, icon: <XIcon size={16} />, label: "Plus refunded" };
  // Sponsor-Plus expired — cleanup worker flipped status to 'expired'
  // when expires_at passed. Coverage helper already rolled back via
  // lazy expiry check; this row gives the parent dashboard a clear
  // beat ("the coverage ended; here's how to reactivate"). Calm
  // neutral palette since it's the natural end of a fixed-term gift.
  if (t === "sponsor_plus_expired")
    return { ...PALETTE.NEUTRAL_MUTED, icon: <Clock size={16} />, label: "Plus ended" };
  if (t === "parent_contribution_failed")
    return { ...PALETTE.ALERT_FAILED, icon: <AlertCircle size={16} />, label: "Charge failed" };
  // Memory family — purple palette (kid-domain story).
  //
  // Eyebrow labels use consistent verb form across all three Memory
  // Book actions (added / edited / deleted). The previous catchall
  // mapped memory_entry_added to "Memory Book" while edited/deleted
  // used verb form, which read as inconsistent on adjacent rows in
  // the feed ("Memory Book" next to "Memory edited" for the same
  // entry's add-then-edit history). User-flagged 2026-05-20:
  // "are all of the milestones and all that perfect?" — caught
  // exactly this inconsistency. Locked verb-form convention.
  if (t === "memory_milestone_added")
    return { ...PALETTE.CELEBRATION_GOLD, icon: <Star size={16} />, label: "Milestone" };
  if (t === "memory_entry_added")
    return { ...PALETTE.MEMORY, icon: <BookOpen size={16} />, label: "Memory added" };
  if (t === "memory_entry_edited")
    return { ...PALETTE.MEMORY, icon: <FileText size={16} />, label: "Memory edited" };
  if (t === "memory_entry_deleted")
    return { ...PALETTE.ALERT_DESTRUCTIVE, icon: <XIcon size={16} />, label: "Memory deleted" };
  // Catchall for any future memory_* type that isn't explicitly
  // handled above. Falls back to the "Memory Book" category label.
  if (t.startsWith("memory_"))
    return { ...PALETTE.MEMORY, icon: <BookOpen size={16} />, label: "Memory Book" };
  // Growth / portfolio family — blue palette (financial movement)
  if (t === "bank_unlinked")
    return { ...PALETTE.ALERT_DESTRUCTIVE, icon: <Building2 size={16} />, label: "Bank removed" };
  if (t === "bank_linked")
    return { ...PALETTE.GROWTH, icon: <Building2 size={16} />, label: "Bank linked" };
  if (GROWTH_TYPES.includes(t))
    return {
      ...PALETTE.GROWTH, icon: <TrendingUp size={16} />,
      // Specific labels per row type — `Cash invested` is its own thing
      // (money moved from balance into holdings), distinct from `Sold`
      // (closed a position) and `Withdrawal` (money left the fund).
      // The fallback "Portfolio" catches bank_linked / bank_unlinked
      // which already get their own configs above; the catch-all is
      // mostly defensive.
      label: t === "sell" ? "Portfolio"
        : t === "withdrawal" ? "Withdrawal"
        : t === "cash_invested" ? "Cash invested"
        : "Portfolio",
    };
  // Account / fund-decision family — neutral palette (parent admin actions)
  if (t === "fund_created")
    return { ...PALETTE.GIFT, icon: <Sprout size={16} />, label: "Fund created" };
  if (t === "fund_strategy_changed")
    return { ...PALETTE.MEMORY, icon: <Sliders size={16} />, label: "Strategy" };
  if (t === "custom_allocations_changed")
    return { ...PALETTE.MEMORY, icon: <Sliders size={16} />, label: "Custom mix" };
  if (t === "event_created")
    return { ...PALETTE.WARNING, icon: <Calendar size={16} />, label: "Occasion" };
  if (t === "event_archived")
    return { ...PALETTE.NEUTRAL_MUTED, icon: <Calendar size={16} />, label: "Archived" };
  if (t === "event_unarchived")
    return { ...PALETTE.WARNING, icon: <Calendar size={16} />, label: "Reopened" };
  if (t === "ssn_provided")
    return { ...PALETTE.GROWTH, icon: <ShieldCheck size={16} />, label: "Tax ID" };
  if (t.startsWith("successor_custodian_"))
    return { ...PALETTE.GROWTH, icon: <UserCheck size={16} />, label: "Successor custodian" };
  if (t === "child_profile_updated")
    return { ...PALETTE.WARNING, icon: <Settings size={16} />, label: "Profile" };
  if (t === "majority_state_updated")
    return { ...PALETTE.GROWTH, icon: <Calendar size={16} />, label: "Age of majority" };
  if (t === "kid_stock_suggestion")
    return { ...PALETTE.MEMORY, icon: <Lightbulb size={16} />, label: "Kid suggestion" };
  if (t === "kid_suggestion_approved")
    return { ...PALETTE.RECURRING, icon: <Check size={16} />, label: "Approved" };
  if (t === "kid_suggestion_declined")
    return { ...PALETTE.NEUTRAL_MUTED, icon: <XIcon size={16} />, label: "Declined" };
  // KYC / compliance — neutral with caution tones
  if (t === "kyc_approved")
    return { ...PALETTE.RECURRING, icon: <ShieldCheck size={16} />, label: "Identity verified" };
  if (t === "kyc_action_required")
    return { ...PALETTE.WARNING, icon: <AlertCircle size={16} />, label: "Identity action needed" };
  if (t === "kyc_pending_review")
    return { ...PALETTE.WARNING, icon: <Clock size={16} />, label: "Identity review" };
  // Subscription
  if (t === "subscription_started" || t === "starter_plan_activated" || t === "family_plan_activated")
    return { ...PALETTE.MEMORY, icon: <CreditCard size={16} />, label: "Subscription" };
  // Event pass (Kiddo Occasions one-time upgrade) — RETIRED 2026-05-13 per
  // the locked product memory. Historical rows in older user feeds still
  // need a meaningful label rather than the generic "Update" fallback the
  // type was falling through to. No new rows of this type are created
  // (the product surface returns 410). When/if every historical row
  // ages out of all users' feeds, this branch and the MILESTONE_TYPES
  // entry below can both be deleted.
  if (t === "event_pass_purchased")
    return { ...PALETTE.MEMORY, icon: <Calendar size={16} />, label: "Occasion pass" };
  if (t === "subscription_renewal")
    // Renewals are a recurring billing event, not a one-shot activation.
    // Distinct label keeps the History feed honest: "Renewed" for repeated
    // monthly/annual charges vs "Subscription" for the original activation.
    return { ...PALETTE.MEMORY, icon: <Repeat size={16} />, label: "Renewed" };
  if (t === "subscription_canceled")
    return { ...PALETTE.NEUTRAL_MUTED, icon: <XIcon size={16} />, label: "Subscription ended" };
  if (t === "payment_failed")
    // Subscription / billing payment failure (different from
    // parent_contribution_failed which is the recurring auto-invest worker).
    // Both share the red AlertCircle treatment so the parent reads "fix me"
    // at the same glance.
    return { ...PALETTE.ALERT_FAILED, icon: <AlertCircle size={16} />, label: "Payment failed" };
  // Milestones engine — celebratory rows (money-cross, returning gifter,
  // anniversary, first-X). Each gets a distinctive emoji-driven pill that
  // reads as a moment, not a transaction. Color stays warm (gold/cream
  // family) so milestones feel like ribbons, not status changes.
  if (t === "milestone_money_cross")
    return { ...PALETTE.MILESTONE_GOLD, icon: <span style={{ fontSize: 16, lineHeight: 1 }}>🌱</span>, label: "Milestone" };
  if (t === "milestone_growth_passed_gifts")
    return { ...PALETTE.MILESTONE_GOLD, icon: <span style={{ fontSize: 16, lineHeight: 1 }}>🌱</span>, label: "Milestone" };
  if (t === "milestone_returning_gifter")
    return { ...PALETTE.SUBTLE_CREAM, icon: <span style={{ fontSize: 16, lineHeight: 1 }}>💚</span>, label: "Returning gifter" };
  if (t === "milestone_unique_gifters")
    return { ...PALETTE.SUBTLE_CREAM, icon: <span style={{ fontSize: 16, lineHeight: 1 }}>🤲</span>, label: "Community" };
  if (t === "milestone_anniversary")
    return { ...PALETTE.MILESTONE_GOLD, icon: <span style={{ fontSize: 16, lineHeight: 1 }}>🎂</span>, label: "Anniversary" };
  if (t === "milestone_first_voice")
    return { ...PALETTE.MEMORY, icon: <span style={{ fontSize: 16, lineHeight: 1 }}>🎙️</span>, label: "First voice" };
  if (t === "milestone_first_photo")
    return { ...PALETTE.MEMORY, icon: <span style={{ fontSize: 16, lineHeight: 1 }}>📷</span>, label: "First photo" };
  if (t === "milestone_first_kid_pick_approved")
    return { ...PALETTE.MEMORY, icon: <span style={{ fontSize: 16, lineHeight: 1 }}>⭐</span>, label: "First pick" };
  // Age-phase milestones (age16/17/18). The age18 family includes the
  // climax of the entire product — kid accepting their fund at 18 — so it
  // gets the brand evergreen + sprout treatment, distinct from generic
  // milestones. Specific labels are friendlier than the raw type names.
  if (t === "age18_child_claimed" || t === "age18_handoff_completed_child")
    return { ...PALETTE.RECURRING, icon: <Sprout size={16} />, label: "Fund handed off" };
  if (t === "age18_handoff_completed_parent")
    return { ...PALETTE.RECURRING, icon: <Sprout size={16} />, label: "Handoff complete" };
  if (t === "age18_handoff_requested")
    return { ...PALETTE.WARNING, icon: <Clock size={16} />, label: "Handoff requested" };
  // Labels renamed 2026-05-12 from "Age-18" / "Age-17" to state-agnostic
  // forms — UTMA majority age varies by state (18-21), and this function is
  // keyed on event-type strings without fund context, so it can't access
  // the per-fund majorityAge. Renaming to semantic labels ("Ownership
  // invite" / "Memory Book preview") works for any state-majority age.
  // Internal event-type strings keep their original "age18_*" / "age17_*"
  // names for server compat.
  if (t === "age18_invite_prepared")
    return { ...PALETTE.MEMORY, icon: <Mail size={16} />, label: "Ownership invite" };
  if (t === "age18_preview_prepared" || t === "age17_memory_book_preview")
    return { ...PALETTE.MEMORY, icon: <Star size={16} />, label: "Memory Book preview" };
  if (t === "age16_parent_notice" || t === "age18_handoff_ready")
    return { ...PALETTE.WARNING, icon: <BellRing size={16} />, label: "Age milestone" };
  // Lifecycle nudges
  if (t.startsWith("lifecycle_"))
    return { ...PALETTE.WARNING, icon: <BellRing size={16} />, label: "Nudge" };
  // Fallback
  return { ...PALETTE.GROWTH, icon: <Calendar size={16} />, label: "Update" };
}

// Public accessor — visual (bg/color/icon) from resolveTypeVisual above, but
// the LABEL comes from the shared canonical source so every surface that shows
// this event (feed, deep-link detail page, detail-history modal, dashboard,
// native app) names it identically. Falls back to the legacy inline label for
// any type the canonical map doesn't cover. See shared/activity-semantics.ts.
function getTypeConfig(type?: string | null): { bg: string; color: string; icon: React.ReactNode; label: string } {
  const v = resolveTypeVisual(type);
  return { ...v, label: canonicalLabel(type) ?? v.label };
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "string") return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function extractTicker(meta: Record<string, unknown>, title?: string | null): string | null {
  if (meta.ticker && typeof meta.ticker === "string") return meta.ticker.toUpperCase();
  // fallback: parse "AAPL gift invested" or "invested into AAPL"
  const text = title || "";
  const m = text.match(/^([A-Z]{1,5})\s+gift/i) || text.match(/into\s+([A-Z]{1,5})\b/i);
  return m ? m[1].toUpperCase() : null;
}

// Display-time rewrite of legacy "Auto-invest *" / "Auto-invested *"
// activity titles.
//
// The server emits the locked-copy versions for new rows:
//   • Schedule events:    server/routes.ts:12009, 12120
//     "Recurring investment started/updated/cancelled"
//   • Cash-sweep events:  server/routes.ts:7185-7195
//     "Cash invested across N positions" (plural)
//     "Invested cash in {Name}" (singular)
// But rows written before those renames still carry the old verb in
// their title column. The locked-copy rule
// (feedback_no_contribute_word.md + the Recurring Investments naming
// note in MEMORY.md) bans "auto-invest" / "auto-invested" from user-
// facing surfaces. Rewriting at read time handles legacy data without
// a destructive migration. New rows pass through unchanged.
//
// Three legacy patterns covered, in priority order:
//   1. Schedule-state events: "Auto-invest started" etc.
//      → "Recurring investment started" etc.
//   2. Cash sweep, multi-position: "Auto-invested across 4 positions"
//      → "Cash invested across 4 positions"
//   3. Cash sweep, single-position: "Auto-invested in Apple"
//      → "Invested cash in Apple"
//
// Used by every surface that renders item.title:
//   • Row renderer (effectiveTitle)
//   • CSV export (handleExportCsv)
//   • Issue-report email subject + body
//   • Pending list
// so a legacy row reads identically whether the parent is scanning
// the feed or reconciling a download.
function rewriteLegacyAutoInvestTitle(t: string | null | undefined): string {
  if (!t) return "Fund update";
  // Schedule state changes (started/updated/cancelled/turned on/off/resumed).
  const schedule = t.match(/^Auto-invest (started|updated|cancelled|turned on|turned off|resumed)$/i);
  if (schedule) return `Recurring investment ${schedule[1].toLowerCase()}`;
  // Cash sweep, multi-position. Preserve the trailing position count.
  const multi = t.match(/^Auto-invested across (\d+) positions?$/i);
  if (multi) return `Cash invested across ${multi[1]} position${multi[1] === "1" ? "" : "s"}`;
  // Cash sweep, single-position. Preserve the asset name verbatim
  // (could be a ticker like "AAPL" or a brand name like "Apple").
  const single = t.match(/^Auto-invested in (.+)$/i);
  if (single) return `Invested cash in ${single[1]}`;
  // Memory Book naming alignment. The "added" event title was
  // "Memory Book entry added" while the "edited" sibling was just
  // "Memory entry edited" — looked like two different surfaces in
  // the feed. Server now writes "Memory Book entry edited"; this
  // rewrite normalizes legacy rows. Locked 2026-05-20.
  if (t === "Memory entry edited") return "Memory Book entry edited";
  return t;
}

// Legacy description rewrite. Fixes two display-time bugs:
//
//   1. Singular/plural bug: legacy rows wrote `across 1 positions.`
//      (always plural). Modern emitter uses conditional pluralization
//      (server/routes.ts:7191) but pre-rename rows still carry the
//      buggy "1 positions" form in the description column.
//   2. Trailing-zero share counts: legacy rows wrote `0.5000 shares`
//      using toFixed(4) unconditionally. Trimming trailing zeros
//      down to at most 1 decimal makes simple half-shares read as
//      "0.5 shares" instead of "0.5000 shares" — easier for parents
//      who don't need 4-decimal precision for whole halves. The
//      replacer handles singular/plural by counting the final value:
//      "0.5000 shares" → "0.5 shares" (fractional → plural),
//      "1.0000 shares" → "1 share" (whole-1 → singular),
//      "2.0000 shares" → "2 shares" (whole-N → plural),
//      "0.4823 shares" → "0.4823 shares" (no change; full precision
//        is load-bearing for awkward fractions).
//
// Both fixes apply to descriptions written before the polish landed.
// New rows pass through unchanged.
function rewriteLegacyDescription(d: string | null | undefined): string | null {
  if (!d) return d ?? null;
  // Drop dead filler so the feed doesn't read templated/"AI" down a column of gifts:
  // "No note." (a note-less gift needs no body) and the redundant "$X gift received" (the
  // amount is already shown on the row). Returning null → the body simply isn't rendered.
  // Cleans EXISTING rows at display time; the server now writes something useful for new
  // gifts (webhookHandlers). 2026-06-01.
  const t = d.trim();
  if (t === "No note." || /^\$[\d,]+(\.\d{2})? gift received$/i.test(t)) return null;
  let out = d;
  // Singular/plural for position count.
  out = out.replace(/\bacross 1 positions\b/g, "across 1 position");
  // Trailing-zero trim + singular/plural reconciliation for share counts.
  out = out.replace(/(\d+)\.(\d{1,4})\s+shares?\b/g, (_match, whole: string, frac: string) => {
    const trimmed = frac.replace(/0+$/, "");
    if (trimmed === "") {
      // Whole number: singular only when exactly 1.
      return whole === "1" ? `${whole} share` : `${whole} shares`;
    }
    // Genuine fraction: finance convention is always plural.
    return `${whole}.${trimmed} shares`;
  });
  // Hyphen → "to" on settlement-window phrases. Legacy sell rows
  // wrote "1-2 business days" (hyphenated); current emitter uses
  // "1 to 2 business days" (server/routes.ts:6420). Normalize the
  // older format so a parent scanning the feed doesn't see two
  // different phrasings of the same regulatory window across rows.
  // Locked 2026-05-20 per the Activity register pass.
  out = out.replace(/\b1-2 business days\b/g, "1 to 2 business days");
  // Also fold the spaced-hyphen variant ("1 - 2 business days") that
  // appeared in a handful of even-older rows.
  out = out.replace(/\b1\s*-\s*2 business days\b/g, "1 to 2 business days");
  return out;
}

function parseSafeDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function parseAmount(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function groupByMonth(items: FeedActivity[]): { label: string; items: FeedActivity[] }[] {
  const groups = new Map<string, FeedActivity[]>();
  items.forEach((item) => {
    const d = parseSafeDate(item.createdAt);
    const key = d
      ? d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "Earlier";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

// ── Recurring-run collapse ───────────────────────────────────────────────
// A parent's monthly auto-invest fires one identical row per month. Over a
// 13-year fund that's ~150 near-identical "You contributed $75 — Every month,
// a little more. From Dad." rows that BURY the gifts people actually sent (the
// emotional core of the ledger). We fold a maximal run of CONSECUTIVE recurring
// contributions — nothing else between them in the feed — into one expandable
// summary, so quiet stretches compress while eventful months (the ones with a
// real gift) stay open. Runs shorter than MIN render normally. Only applied in
// the default "all" browse (not when a filter/search is narrowing intent).
// Mirrors the Memory Book's own recurring collapse.
const RECURRING_RUN_TYPE = "__recurring_run__";
const MIN_RECURRING_RUN = 3;

function isRecurringContribItem(item: FeedActivity): boolean {
  // Collapse only TRUE recurring cycles — those linked to a recurring schedule
  // via parentContributionId (the webhook + seed both stamp it into the activity
  // metadata for worker-fired cycles). A parent ONE-TIME addition is also a
  // "parent_contribution" with isParentContribution=true, but carries NO
  // parentContributionId — it must stay its own row (often a pick with its own
  // ticker + note), not get absorbed into the "Monthly contributions" run where
  // it would mislabel the group ("13 contributions · $1,350", no "$100 each")
  // and lose its detail.
  try {
    const meta = parseMetadata((item as any).metadata);
    const pcId = (meta as any)?.parentContributionId;
    return typeof pcId === "string" && pcId.length > 0;
  } catch {
    return false;
  }
}

function collapseRecurringRuns(items: FeedActivity[]): FeedActivity[] {
  const out: FeedActivity[] = [];
  let run: FeedActivity[] = [];
  const flush = () => {
    if (run.length >= MIN_RECURRING_RUN) {
      const newest: any = run[0];                 // feed is newest-first
      const oldest: any = run[run.length - 1];
      const total = run.reduce((s, r) => s + (parseAmount((r as any).amount) || 0), 0);
      out.push({
        ...newest,
        id: `recurring-run-${newest.id || newest.createdAt}`,
        type: RECURRING_RUN_TYPE,
        amount: String(total),
        __run: { items: run.slice(), count: run.length, total, newestAt: newest.createdAt, oldestAt: oldest.createdAt },
      } as any);
    } else {
      out.push(...run);
    }
    run = [];
  };
  for (const item of items) {
    if (isRecurringContribItem(item)) run.push(item);
    else { flush(); out.push(item); }
  }
  flush();
  return out;
}

function RecurringRunRow({ run, isLast, expanded, onToggle }: { run: any; isLast: boolean; expanded: boolean; onToggle: () => void }) {
  const items: any[] = run.__run?.items ?? [];
  const count: number = run.__run?.count ?? items.length;
  const total: number = run.__run?.total ?? 0;
  const newest = parseSafeDate(run.__run?.newestAt);
  const oldest = parseSafeDate(run.__run?.oldestAt);
  const my = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "");
  const range = oldest && newest ? `${my(oldest)} – ${my(newest)}` : "";
  const amounts = items.map((it) => parseAmount(it.amount) || 0);
  const uniform = amounts.length > 0 && amounts.every((a) => a === amounts[0]);
  const note = (() => {
    try { const m = parseMetadata(items[0]?.metadata); return typeof (m as any)?.message === "string" ? (m as any).message : null; } catch { return null; }
  })();
  return (
    <div style={{ borderLeft: "3px solid rgb(150,176,158)", background: "linear-gradient(to right, rgba(150,176,158,0.07) 0%, transparent 64%)", borderRadius: 8, marginLeft: -3, paddingLeft: 8 }} data-testid={`activity-recurring-run-${run.id}`}>
      <button type="button" onClick={onToggle} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 0", borderBottom: (!isLast || expanded) ? "1px solid rgba(26,23,16,0.06)" : "none", width: "100%", textAlign: "left", background: "transparent", cursor: "pointer" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "rgb(234,239,233)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(96,124,104,0.16)" }}>
          <Repeat size={16} style={{ color: "rgb(96,124,104)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.3 }}>Monthly contributions</p>
            <p className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: "rgb(26,23,16)", whiteSpace: "nowrap" }}>+{formatCurrency(total)}</p>
          </div>
          <p style={{ fontSize: 12, color: "rgb(120,110,102)", marginTop: 2 }}>
            {count} contributions · {range}{uniform ? ` · ${formatCurrency(amounts[0])} each` : ""}
          </p>
          {note ? <p style={{ fontSize: 12, fontStyle: "italic", color: "rgb(140,130,122)", marginTop: 4, overflowWrap: "anywhere" }}>&ldquo;{note}&rdquo;</p> : null}
          <p style={{ fontSize: 11.5, fontWeight: 600, color: "rgb(96,124,104)", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {expanded ? "Hide" : "Show all"} {count}
            <ChevronDown size={12} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </p>
        </div>
      </button>
      {expanded ? (
        <div style={{ paddingLeft: 48, paddingBottom: 10 }}>
          {items.map((it, idx) => {
            const d = parseSafeDate(it.createdAt);
            const amt = parseAmount(it.amount) || 0;
            return (
              <div key={(it.id as string) || idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", fontSize: 12.5, color: "rgb(90,82,74)", borderTop: idx > 0 ? "1px solid rgba(26,23,16,0.04)" : "none" }}>
                <span>{d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</span>
                <span style={{ fontWeight: 600, color: "rgb(26,23,16)" }}>+{formatCurrency(amt)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// StatusPill now lives in @/lib/activity-helpers and is imported above — the
// two copies were byte-for-byte identical (same palette values, icons, and the
// type-derived "failed" fallback for parent_contribution_failed /
// payment_failed). Single source so the feed, the detail-history modal, and the
// deep-link detail page render the status chip identically.

// Inline SkeletonRow replaced by the shared KiddoSkeleton primitive — see
// the loading state below. This keeps the local skeleton declaration removed
// so future variations all flow through the named-variant API.

// "milestones" intentionally dropped 2026-06-01: it was a sparse filter that
// duplicated the Memory Book (the real home for the emotional lifecycle) and
// rendered near-empty for young funds. Milestone/memory rows still appear under
// "All". A stale ?filter=milestones URL falls back to "all" via the check below.
const VALID_FILTERS: FilterType[] = ["all", "gifts", "auto", "growth"];

export default function Activity() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const queryClient = useQueryClient();
  // Respect prefers-reduced-motion for in-page motion. Route-level
  // entry/exit is already covered by RouteFader in App.tsx; this
  // catches the AnimatePresence + motion.div blocks INSIDE the
  // page content (row expansions, list reveals, group transitions).
  // Per WCAG 2.3.3, motion animations triggered by interaction
  // must be disabled when the user has the OS preference set.
  // Audit 2026-05-25 caught Activity as one of the heavy-motion
  // pages missing this explicit check. The motion.divs below use
  // initial / animate patterns that respect the flag where
  // adopted; new motion sites should follow the same pattern.
  const prefersReducedMotion = useReducedMotion();

  // Action items — the "needs your attention" section above the
  // history feed. Sticks at the top regardless of how old the
  // underlying activity is, because the bell badge counts these
  // until resolved, not until read. See project_action_items
  // _architecture for the read-vs-resolved split.
  const { items: actionItems } = useActionItems();

  // Idle-time prefetch of next-likely pages so taps from Activity →
  // Dashboard / Memory Book render from cache. Symmetric with the prefetch
  // on Dashboard and MemoryBook — every primary page pre-warms its likely
  // neighbors during browser idle. Uses the stored active fund id since
  // Activity is fund-agnostic at the route level.
  useEffect(() => {
    if (!isAuthenticated) return;
    const fundId = getActiveFundId();
    const cancel = onIdle(() => {
      prefetchDashboard(queryClient, fundId);
      if (fundId) prefetchMemoryBook(queryClient, fundId);
    });
    return cancel;
  }, [isAuthenticated, queryClient]);

  // markNotificationsRead — moved below the useActivities call, see
  // the comment there. Activities aren't in scope here.
  // Honor ?filter=<type> + ?tab=<tab> + ?highlight=<id> on first mount so
  // dashboard deep-links land on the right tab AND scroll to / highlight
  // the specific row the parent tapped from. Read once on mount; subsequent
  // URL changes don't override the user's tab choice.
  const initialFilter = useMemo<FilterType>(() => {
    const params = new URLSearchParams(searchString);
    const raw = (params.get("filter") || "").toLowerCase();
    return VALID_FILTERS.includes(raw as FilterType) ? (raw as FilterType) : "all";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initialTab = useMemo<ActivityTab>(() => {
    const params = new URLSearchParams(searchString);
    const raw = (params.get("tab") || "").toLowerCase();
    return raw === "pending" || raw === "scheduled" ? raw : "history";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initialHighlight = useMemo<string | null>(() => {
    const params = new URLSearchParams(searchString);
    return params.get("highlight") || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Per-row "New" dismissal. seenBeforeArrival freezes the "new since last
  // visit" set for the whole visit (so the page can answer "the badge said N,
  // here are the N"); but opening a row IS reading it, so clearing that row's
  // own "New" on expand matches the universal read-it convention (founder
  // 2026-06-12: "when clicking on it, shouldn't the New go away?"). Visit-scoped
  // and add-only — the next visit's clean slate comes from seenBeforeArrival,
  // and collapsing a row again must not resurrect its badge.
  const [dismissedNewIds, setDismissedNewIds] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<ActivityTab>(initialTab);
  // Keep tab state in sync with URL changes — the chip in the expanded
  // row's "Manage schedules →" navigates to `?tab=scheduled` while the
  // user is already on /activity. Wouter doesn't unmount the page on
  // same-route query change, so initialTab (which reads URL on mount)
  // never re-fires. This effect syncs whenever the URL tab param
  // changes, including same-page deep-link navigation.
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const raw = (params.get("tab") || "").toLowerCase();
    if (raw === "history" || raw === "pending" || raw === "scheduled") {
      setTab((current) => (current === raw ? current : raw));
    }
  }, [searchString]);
  const [highlightedId, setHighlightedId] = useState<string | null>(initialHighlight);
  // Per-suggestion in-flight review state. Keyed by the kid suggestionId so
  // multiple expanded rows can show their own loading state independently.
  // After the POST settles, we refetch activities — the new
  // kid_suggestion_approved/declined row appears AND the original suggestion
  // row hides its buttons (derived check below).
  const [reviewingSuggestionId, setReviewingSuggestionId] = useState<string | null>(null);

  // Find the highlighted row by data-testid pattern (different per tab) and
  // scroll it into view + apply a brief highlight class. Clears the URL
  // param after firing so a back-then-forward navigation doesn't re-trigger.
  // Uses a polling helper so we wait until the tab content + react-query
  // data have actually mounted — a fixed-frame approach silently failed
  // when the row hadn't rendered yet.
  useEffect(() => {
    if (!highlightedId) return;
    const cancel = scrollToFirstMatchingTestId(
      [
        `scheduled-contrib-${highlightedId}`,
        `activity-card-${highlightedId}`,
        `pending-row-${highlightedId}`,
      ],
      {
        onFound: () => {
          // Clear the URL param so back/forward doesn't re-fire.
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("highlight");
            window.history.replaceState({}, "", url.toString());
          } catch {
            // best-effort URL cleanup
          }
          // Hold the highlight for 2.5s then drop it.
          window.setTimeout(() => setHighlightedId(null), 2500);
        },
        onMissed: () => {
          // Row never showed — drop the highlight so we don't leave a
          // stale glow waiting on nothing.
          setHighlightedId(null);
        },
      },
    );
    return cancel;
  }, [highlightedId, tab]);

  // Activity is scoped to the currently-active fund. Without this scope the
  // /api/activities response is shared across every fund the parent owns —
  // which means a parent with several funds sees the latest 50 activity rows
  // from ALL funds, diluting any single fund's view to whichever rows
  // happened to land in the top 50 sort. The 30-day sums on the page header
  // are particularly sensitive to this — they were summing rows from other
  // funds entirely, which was the source of the "$375 vs $875" discrepancy
  // the parent reported. Server now accepts ?fundId= and returns up to 200
  // rows for that fund only.
  // Active fund held in component state so the activity feed reacts to
  // AppHeader fund switches. Was reading getActiveFundId() inline every
  // render — pulls fresh from localStorage but doesn't trigger a re-render
  // when the user changes funds. Without this listener, the activity feed
  // kept showing rows from the previously-active fund. Same parallel bug
  // and listener-based fix as Projection / TaxDocuments / Age18Plan.
  const [activeFundIdForActivity, setActiveFundIdForActivity] = useState<string>(() => getActiveFundId());
  // Owner-mode: the set of the viewer's funds that have been handed off to them as the
  // adult owner (accessRole 'owner' + transferredAt). Used to flip "{child}'s fund" ->
  // "your fund" per row in this cross-fund feed. Reuses the cached /api/funds query (same
  // queryKey), so no extra fetch. 2026-05-29.
  const { data: allFundsForOwnerMode = [] } = useFunds();
  const ownerModeFundIds = useMemo(
    () => new Set(
      (allFundsForOwnerMode as any[])
        .filter((f: any) => f?.accessRole === "owner" && f?.transferredAt)
        .map((f: any) => String(f.id)),
    ),
    [allFundsForOwnerMode],
  );
  useEffect(() => {
    const handler = (e: Event) => {
      const newId = (e as CustomEvent<{ id: string }>).detail?.id;
      if (newId && typeof newId === "string") setActiveFundIdForActivity(newId);
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);
  // A post-handoff OWNER's fund history lives under the PREVIOUS owner's userId, so the
  // user-scoped /api/activities returns nothing for them (the rows aren't theirs) — which is
  // why Haley's History reads "Nothing here yet" on a 16-year fund. When the active fund is
  // one the viewer now owns (transferred), read the FUND-scoped feed instead so the full
  // history — gifts, milestones, the handoff itself — shows. The Memory Book already carries
  // over because it's fund-scoped; this gives Activity parity. (The general server fix is to
  // make /api/activities fund-aware for owned funds; this is the collision-free client
  // equivalent.) ownerModeFundIds is built above.
  const activeFundIsOwned = !!activeFundIdForActivity && ownerModeFundIds.has(String(activeFundIdForActivity));
  const userScopedFeed = useActivities(200, isAuthenticated && !authLoading && !activeFundIsOwned, activeFundIdForActivity);
  const fundScopedFeed = useFundActivities(activeFundIsOwned ? activeFundIdForActivity : undefined, 200);
  const activities = (activeFundIsOwned ? fundScopedFeed.data : userScopedFeed.data) ?? [];
  const feedLoading = activeFundIsOwned ? fundScopedFeed.isLoading : userScopedFeed.isLoading;
  const feedError = activeFundIsOwned ? fundScopedFeed.isError : userScopedFeed.isError;
  const refetch = activeFundIsOwned ? fundScopedFeed.refetch : userScopedFeed.refetch;

  // Landing on the Activity page IS "I've seen the latest." Clears the
  // bottom-nav and sidebar Activity dot. Without this, the only way to
  // clear the dot was opening the bell panel and tapping mark-all-read,
  // which is a confusing two-step from the user's perspective ("I went
  // to Activity, why is it still showing me a dot?").
  //
  // Server clock skew defense — see markNotificationsRead in
  // NotificationsPanel.tsx. We pass the max createdAt across the
  // currently-loaded activities so the mark provably covers every row
  // the user can see, regardless of how far ahead the server clock is.
  // Without this, `Date.now()` (client time) can be < server-generated
  // `createdAt`, leaving rows flagged as unread immediately after the
  // mark. Reproducible bug: "I read it, then it marks itself unread
  // again." Effect re-runs whenever activities change, so refetches
  // that pull in newer rows while the user is still on the Activity
  // page also clear cleanly.
  // Capture what the user had ALREADY seen, ONCE on arrival, BEFORE the effect
  // below clears the badge. Rows newer than this get a "New" marker, so the
  // Activity page can answer "the badge said 2, here are the 2." Without it the
  // page marks everything read on landing and nothing reads as new ("badge said
  // N, click in, can't tell what was new"). Lazy init = the pre-visit value,
  // frozen for the whole visit. seenBeforeArrival of 0 (never read) marks
  // nothing, since a first-ever visitor has no "new since" reference.
  const [seenBeforeArrival] = useState<number>(() => getLastReadAt());
  useEffect(() => {
    if (!isAuthenticated) return;
    const list = activities as { createdAt?: string | Date | null }[];
    const latestTime = list.reduce((max, a) => {
      const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      return Number.isFinite(t) && t > max ? t : max;
    }, 0);
    markNotificationsRead(latestTime);
  }, [isAuthenticated, activities]);

  // Approve or decline a kid stock suggestion straight from the Activity row.
  // POSTs to the existing /kid-view-suggestions/:id PATCH endpoint, then
  // refetches the activity feed so (a) the original suggestion row hides
  // its buttons (derived check sees the new review activity), AND (b) the
  // new "You approved Emma's AZO" row appears below for audit. Optimistic
  // local state during the round-trip prevents accidental double-clicks.
  const reviewSuggestion = async (
    fundIdForReview: string,
    suggestionId: string,
    status: "approved" | "declined",
  ) => {
    if (!fundIdForReview || !suggestionId || reviewingSuggestionId) return;
    setReviewingSuggestionId(suggestionId);
    haptic(status === "approved" ? "medium" : "light");
    try {
      const res = await fetch(
        `/api/funds/${fundIdForReview}/kid-view-suggestions/${suggestionId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedStatus: status }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
    } catch (err) {
      console.error("[activity] review suggestion failed:", err);
    } finally {
      setReviewingSuggestionId(null);
    }
  };

  // Build a quick-lookup set of suggestion IDs that have ALREADY been
  // reviewed (= a kid_suggestion_approved/declined activity exists for them).
  // Used by the row render below to swap the Approve/Decline buttons for a
  // persistent "✓ Approved" / "✗ Declined" pill.
  const reviewedSuggestionIds = useMemo(() => {
    const map = new Map<string, "approved" | "declined">();
    for (const a of activities as FeedActivity[]) {
      const t = normalizeActivityType(a.type);
      if (t !== "kid_suggestion_approved" && t !== "kid_suggestion_declined") continue;
      const meta = parseMetadata((a as any).metadata);
      const sid = typeof meta.suggestionId === "string" ? meta.suggestionId : null;
      if (sid) map.set(sid, t === "kid_suggestion_approved" ? "approved" : "declined");
    }
    return map;
  }, [activities]);

  // ?highlight=ID accepts EITHER an activity row's own id OR a gift's id. The
  // scroll effect above polls for `activity-card-{id}` (etc.), which is the
  // activity row's id. Callers that only know the gift id (notifications,
  // gift toasts, etc.) can pass it directly — this effect translates it to
  // the matching activity id once activities load.
  //
  // Why this matters: the natural URL contract is `?highlight={giftId}` since
  // gift id is what every other surface (Memory Book, HoldingDetailSheet) uses.
  // Without this translation, callers had to know the activity row id, which
  // they almost never do.
  useEffect(() => {
    if (!highlightedId || activities.length === 0) return;
    // Already a valid activity row id — direct match path will work.
    if ((activities as FeedActivity[]).some((a) => String(a.id) === highlightedId)) return;
    // Look for an activity whose metadata stash contains this gift id.
    const match = (activities as FeedActivity[]).find((a) => {
      const raw = (a as any).metadata;
      if (!raw || typeof raw !== "string") return false;
      try {
        const parsed = JSON.parse(raw) as { giftId?: unknown };
        return typeof parsed.giftId === "string" && parsed.giftId === highlightedId;
      } catch {
        return false;
      }
    });
    if (match) setHighlightedId(String(match.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, highlightedId]);

  // Cross-fund roll-up for the Pending and Scheduled tabs. Single round trip, served by
  // /api/me/scheduled. Both contributions and reminders carry their fund's name +
  // recipient first name so rows can render "into Emma's mix" without per-fund follow-ups.
  const { data: scheduledData } = useQuery<{
    contributions: Array<any>;
    reminders: Array<any>;
  }>({
    queryKey: ["/api/me/scheduled"],
    queryFn: async () => {
      const res = await fetch("/api/me/scheduled", { credentials: "include" });
      if (!res.ok) return { contributions: [], reminders: [] };
      return res.json();
    },
    enabled: isAuthenticated && !authLoading,
    staleTime: 60_000,
  });
  // Scope scheduled rows to the active fund. The /api/me/scheduled
  // endpoint is intentionally cross-fund (single round trip), so we filter
  // here to match Activity's per-fund design — without this, parents see
  // recurring schedules from sibling/test funds on the active fund's
  // page (e.g., Bob's $25/mo showing on Emma's Activity).
  const scheduledContribs = (scheduledData?.contributions ?? []).filter(
    (c: any) => !activeFundIdForActivity || c.fundId === activeFundIdForActivity,
  );
  const scheduledReminders = (scheduledData?.reminders ?? []).filter(
    (r: any) => !activeFundIdForActivity || r.fundId === activeFundIdForActivity,
  );

  // Same per-fund scoping for the "Needs your attention" cards. The
  // /api/me/action-items endpoint is intentionally cross-fund (it feeds
  // the global bell badge too), so without this filter a sibling/test
  // fund's todo (e.g. "sssss's Fund needs an SSN") surfaces on Emma's
  // fund-scoped Activity page. The bell badge + Dashboard still show the
  // full cross-fund list; only this per-fund surface narrows to the
  // active fund. Mirrors the scheduled-rows fix directly above.
  const scopedActionItems = actionItems.filter(
    (item) => !activeFundIdForActivity || item.fundId === activeFundIdForActivity,
  );

  // Fund value-history (snapshot series) for the active fund — the only honest
  // source for the money summary's "Market growth" line. The activity feed has
  // no "market grew $X" row (growth isn't an event), so without this that tile
  // hard-coded $0 and read as "your investments are flat" even on a fund up
  // 50%. Each point carries totalValue + principalBasis; (value − basis) is the
  // unrealized market gain at that moment, so the gain delta across any window
  // is the market growth during it, with contributions netted out cleanly.
  // Placed here (before the auth early-returns below) to keep hook order stable.
  const { data: fundHistory = [] } = useQuery<Array<{ snapshotDate: string; totalValue: string; principalBasis: string }>>({
    queryKey: ["/api/funds", activeFundIdForActivity, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFundIdForActivity}/history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !authLoading && !!activeFundIdForActivity,
    staleTime: 60_000,
  });

  // Mutations for the Scheduled tab management surface. Endpoints already
  // existed (Dashboard uses them); Activity just hooks them up so parents
  // don't have to navigate elsewhere to pause/resume/cancel/top up a
  // schedule. Single canonical pattern: PATCH for status, DELETE for
  // cancel, POST contribute-now for a one-off Stripe checkout.
  const pauseToggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" }) => {
      const res = await fetch(`/api/parent-contributions/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Could not update schedule");
      }
      return res.json();
    },
    onSuccess: (_data: unknown, variables: { id: string; status: "active" | "paused" }) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/me/scheduled"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: variables.status === "paused" ? "Schedule paused" : "Schedule resumed",
        description: variables.status === "paused"
          ? "We won't run this until you turn it back on."
          : "Next charge will run on its scheduled date.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Could not update", description: err?.message || "Try again in a moment.", variant: "destructive" });
    },
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/parent-contributions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Could not cancel schedule");
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/me/scheduled"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({ title: "Schedule cancelled", description: "The recurring investment won't run again." });
    },
    onError: (err: any) => {
      toast({ title: "Could not cancel", description: err?.message || "Try again in a moment.", variant: "destructive" });
    },
  });

  const contributeNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/parent-contributions/${id}/contribute-now`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || "Could not start checkout.");
      return data.url as string;
    },
    onSuccess: (url: string) => {
      window.location.href = url;
    },
    onError: (err: any) => {
      toast({ title: "We couldn't process that", description: err?.message || "Try again in a moment.", variant: "destructive" });
    },
  });

  const cancelReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-gifts/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Could not cancel reminder");
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/me/scheduled"] });
      // Kind-neutral copy: this mutation stops BOTH reminder-only cadences
      // (we stop emailing) and auto-charge subscriptions (Stripe sub is
      // cancelled server-side). The per-row confirm already told the parent
      // exactly which one they're stopping.
      toast({ title: "Schedule stopped", description: "This gifter's schedule for the fund has ended." });
    },
    onError: (err: any) => {
      toast({ title: "Could not stop the schedule", description: err?.message || "Try again in a moment.", variant: "destructive" });
    },
  });

  const [expandedScheduledId, setExpandedScheduledId] = useState<string | null>(null);
  const toggleScheduledExpand = (id: string) =>
    setExpandedScheduledId((cur) => (cur === id ? null : id));

  // ===== Detail history modal =====
  // Generic "show me everything about X" surface. One state controls which
  // scope is open (a specific recurring schedule, or the parent's
  // contributions in aggregate). The modal subsumes the per-row deep-dive
  // story Acorns ships natively; the same pattern will be reused later
  // for holdings / gifters / occasions without rebuilding the shell.
  type DetailScope =
    | { kind: "schedule"; scheduleId: string }
    | { kind: "contributions" }
    | null;
  const [detailScope, setDetailScope] = useState<DetailScope>(null);
  // Sub-toggle state for the contributions modal: Recurring | One-time | All.
  const [contributionsSubFilter, setContributionsSubFilter] = useState<"all" | "recurring" | "onetime">("all");

  // Honor ?detail=schedule:{id} or ?detail=contributions on first mount so
  // notification emails / shareable links land directly inside a specific
  // detail view without forcing the parent to navigate twice. URL gets
  // cleaned on close so back-then-forward doesn't reopen.
  //
  // Unmount cleanup added 2026-05-18: if the parent navigates AWAY
  // from Activity with the modal still open, drop the ?detail param
  // so a future return to Activity doesn't auto-re-open the modal.
  // The deep-link semantic is preserved (email click → modal opens)
  // but the navigation-away semantic ("I'm done with this view") is
  // now respected. Without this, the parent's reflex of bouncing
  // out and back into Activity surfaced a stale modal state and
  // read as a bug ('this modal was already there?').
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const raw = params.get("detail");
    if (raw) {
      if (raw === "contributions") {
        setDetailScope({ kind: "contributions" });
      } else {
        const m = raw.match(/^schedule:(.+)$/);
        if (m && m[1]) setDetailScope({ kind: "schedule", scheduleId: m[1] });
      }
    }
    return () => {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("detail")) {
          url.searchParams.delete("detail");
          window.history.replaceState({}, "", url.toString());
        }
      } catch {
        // best-effort
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const closeDetailScope = () => {
    setDetailScope(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("detail");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // best-effort URL cleanup
    }
  };
  const openDetailScope = (scope: NonNullable<DetailScope>) => {
    haptic("selection");
    setDetailScope(scope);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(
        "detail",
        scope.kind === "schedule" ? `schedule:${scope.scheduleId}` : "contributions",
      );
      window.history.replaceState({}, "", url.toString());
    } catch {
      // best-effort URL cleanup
    }
  };
  const cachedActivities = useMemo(
    () => (readLocalCache<ActivityType[]>(`${LOCAL_CACHE_KEYS.activities}:50`) || []) as FeedActivity[],
    [],
  );

  if (!authLoading && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  if (authLoading) {
    return (
      <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-activity">
        <AppHeader />
        <main className="kiddo-canvas px-4 py-5 md:py-6 space-y-4">
          <div style={{ height: 28, background: "rgba(26,23,16,0.06)", borderRadius: 8, width: 120 }} />
          <div className="kiddo-card" style={{ padding: "0 18px" }}>
            {[1, 2, 3, 4].map(i => <KiddoSkeleton key={i} variant="list-row" />)}
          </div>
        </main>
      </div>
    );
  }

  // Dedupe paired gift rows. The server emits BOTH `gift_received` (when the
  // payment lands) AND `gift_invested` (when the auto-invest fires seconds
  // later) for every incoming gift — that's correct for the audit ledger
  // but reads as a duplicate row in the parent's Activity feed. The
  // `gift_received` row already shows the destination ticker chip + amount
  // + note, so when a matching `gift_invested` exists for the same giftId
  // we drop it from the visible feed. We don't suppress server-side
  // because the two activity types ARE distinct events for funds that
  // can't auto-invest immediately (empty universe → `gift_received_cash`,
  // or parent invests gifted cash later from the dashboard — those keep
  // their `gift_invested` row).
  const receivedGiftIds = new Set<string>();
  for (const a of activities as FeedActivity[]) {
    if (normalizeActivityType(a?.type) !== "gift_received") continue;
    const meta = parseMetadata((a as any).metadata);
    const gid = typeof meta.giftId === "string" ? meta.giftId : null;
    if (gid) receivedGiftIds.add(gid);
  }
  const dedupedActivities = (activities as FeedActivity[]).filter((a) => {
    if (normalizeActivityType(a?.type) !== "gift_invested") return true;
    const meta = parseMetadata((a as any).metadata);
    const gid = typeof meta.giftId === "string" ? meta.giftId : null;
    return !(gid && receivedGiftIds.has(gid));
  });

  const filtered = dedupedActivities.filter((item) => {
    const t = normalizeActivityType(item?.type);
    if (isInternalOnlyType(t)) return false;
    if (t.startsWith("lifecycle_")) return false;
    // Test-pattern memory rows must not surface in the parent-facing
    // ledger any more than they do in the Memory Book itself. The
    // memory_entry_added / memory_milestone_added activity rows
    // carry the entry's content in the description field, so a
    // parent who typed "test for recurring" while QA-ing the note
    // editor produces a permanent ledger row labeled
    // "Dovi: test for recurring." Same allowlist as
    // isMemoryBookSuppressedMessage in MemoryBook.tsx + the
    // server-side guard in webhookHandlers.ts. Belt-and-suspenders:
    // existing data still has these rows persisted; this filter
    // keeps them off-screen at render time.
    if (t === "memory_entry_added" || t === "memory_milestone_added") {
      const desc = String(item.description || "").trim();
      // Activity row description shape is "Dovi: <content>" — split
      // off the author prefix so we test the content itself, not the
      // author name. Falls through to the raw description for
      // unprefixed rows.
      const colonIdx = desc.indexOf(":");
      const content = colonIdx >= 0 ? desc.slice(colonIdx + 1).trim() : desc;
      const lower = content.toLowerCase();
      if (!content) return false;
      if (/^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(content)) return false;
      if (/^auto-invest contribution to /i.test(content)) return false;
      // Single-letter-runs and bare punctuation that read as obvious
      // QA filler ("dddd", "rrrrr", "ggggg") — three or more of the
      // same character with nothing else.
      if (/^([a-z])\1{2,}$/i.test(content.replace(/\s+/g, "")) || /^([a-z])\1{4,}/i.test(lower)) return false;
    }
    // Kid-stock-suggestion rows must carry a real reason. An empty /
    // missing reason renders as "Emma suggested AZO because " with
    // nothing after — looks broken AND obscures whether this is a
    // test row or a real suggestion. Filter out suggestion rows
    // whose reasoning is blank or test-pattern. Real kid suggestions
    // produce a reason via the KidView submission flow.
    if (t === "kid_stock_suggestion") {
      const meta = parseMetadata((item as any).metadata);
      const reason = String((meta as any).reason || "").trim();
      if (!reason) return false;
      if (/^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(reason)) return false;
    }
    if (filter !== "all") {
      // Use the item-aware mapItemToCategory (not the type-only
      // mapActivityTypeToCategory) so parent's own one-time gifts ride
      // into "auto" (Yours) not "gift" (From others). Fix shipped
      // 2026-05-25 audit: the Dashboard gifter-modal deep link
      // ?filter=auto&highlight={giftId} was filtering out the row it
      // was trying to land on.
      const cat = mapItemToCategory(item);
      if (filter === "gifts"      && cat !== "gift") return false;
      if (filter === "auto"       && cat !== "auto") return false;
      if (filter === "growth"     && cat !== "growth") return false;
    }
    if (search) {
      // Search matches across title + description PLUS metadata-derived
      // fields (amount, ticker, sender email) so parents doing tax-time
      // reconciliation can find a $250 GOOGL gift by typing "$250", "250",
      // "googl", or the gifter's email — instead of being limited to the
      // exact words in the row's title/description.
      const q = search.toLowerCase().trim();
      const meta = parseMetadata((item as any).metadata);
      const ticker = extractTicker(meta, item.title);
      const tickers: string[] = Array.isArray((meta as any).tickers)
        ? ((meta as any).tickers as unknown[]).filter((t): t is string => typeof t === "string")
        : [];
      const senderEmail = typeof (meta as any).senderEmail === "string"
        ? (meta as any).senderEmail
        : typeof (item as any).senderEmail === "string"
          ? (item as any).senderEmail
          : "";
      const amountRaw = item.amount != null ? String(item.amount) : "";
      // Strip $/commas/spaces so "$1,250" / "1,250" / "1250" all match the
      // raw "1250.00" stored in the amount column.
      const normalizedQ = q.replace(/[$,\s]/g, "");
      const normalizedAmt = amountRaw.replace(/[$,\s]/g, "");

      const haystack = [
        item.title || "",
        item.description || "",
        ticker || "",
        ...tickers,
        senderEmail,
      ].join(" ").toLowerCase();

      const titleHit = haystack.includes(q);
      // Numeric search: only fires when query is digits-only and matches a
      // whole-dollar prefix of the amount. Avoids false positives ("5" in
      // "May 5" of the date label).
      const numericHit = /^[0-9]+(\.[0-9]+)?$/.test(normalizedQ) && normalizedAmt.startsWith(normalizedQ);

      if (!titleHit && !numericHit) return false;
    }
    return true;
  });

  // Collapse the recurring-contribution wall ONLY in the default browse — when
  // the user is filtering ("auto" = show me my contributions) or searching,
  // they want every row, so show them flat.
  const grouped = groupByMonth(
    filter === "all" && !search.trim() ? collapseRecurringRuns(filtered) : filtered,
  );

  // CSV export — exports the currently FILTERED view (so the user can
  // narrow to gifts, search "googl", and export only that subset). Useful
  // for tax reconciliation, custodian audits, or just an offline copy.
  // Generates entirely client-side from the data we already have — no
  // server endpoint, no extra round trip.
  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast({ title: "Nothing to export", description: "Filtered list is empty." });
      return;
    }
    // CSV cell escaper — wraps in quotes when the value contains a comma,
    // quote, or newline, and escapes embedded quotes by doubling them.
    const csvCell = (raw: unknown): string => {
      const s = raw == null ? "" : String(raw);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = ["Date", "Type", "Title", "Description", "Amount", "Ticker", "Sender"];
    const rows = filtered.map((item) => {
      const meta = parseMetadata((item as any).metadata);
      const ticker = extractTicker(meta, item.title) || "";
      const sender = typeof (meta as any).senderEmail === "string"
        ? (meta as any).senderEmail
        : typeof (item as any).senderEmail === "string"
          ? (item as any).senderEmail
          : "";
      const dateStr = item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })
        : "";
      return [
        dateStr,
        item.type || "",
        rewriteLegacyAutoInvestTitle(item.title),
        rewriteLegacyDescription(item.description) || "",
        item.amount != null ? String(item.amount) : "",
        ticker,
        sender,
      ].map(csvCell).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    // Prepend BOM so Excel renders UTF-8 correctly without the user having
    // to manually choose encoding on import.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const kid = (filtered[0] as any)?.recipientFirstName || "fund";
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `kiddo-${String(kid).toLowerCase()}-activity-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Activity exported", description: `${filtered.length} row${filtered.length === 1 ? "" : "s"} downloaded as CSV.` });
  };

  // First-gift detection. Walks the FULL activities array (not the
  // filtered/searched view) to find the chronologically earliest external
  // gift_received row — the iconic "first gift" moment that per the design
  // lens (Emma at 18 looking back) deserves a small celebration in the
  // ledger. We pin the first-gift activity ID and let the row renderer
  // check against it. External-gifters only: parent's own gift_received
  // rows (isParentContribution) don't count as the "first gift" momentum
  // signal — that's a parent contribution, not a community moment.
  const firstGiftId = useMemo(() => {
    let earliest: { id: string; ts: number } | null = null;
    for (const a of activities as FeedActivity[]) {
      if (normalizeActivityType(a?.type) !== "gift_received") continue;
      const enriched = a as any;
      const meta = parseMetadata((a as any).metadata);
      const isParent =
        typeof enriched.isParentContribution === "boolean"
          ? enriched.isParentContribution
          : meta.isParentContribution === true;
      if (isParent) continue;
      const ts = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
      if (!Number.isFinite(ts)) continue;
      if (!earliest || ts < earliest.ts) {
        earliest = { id: String(a.id), ts };
      }
    }
    return earliest?.id ?? null;
  }, [activities]);

  // Summary stats from full unfiltered feed — uses the same paired-gift
  // dedupe so a single $250 grandpa gift counts as $250, not $500
  // (gift_received + gift_invested would otherwise both add to totals).
  const allVisible = dedupedActivities.filter(item => {
    const t = normalizeActivityType(item?.type);
    return !isInternalOnlyType(t) && !t.startsWith("lifecycle_");
  });
  // Summary counts use the item-aware bucketing (mapItemToCategory) so
  // parent's own gift_received rows count toward Investments (Yours)
  // not Gifts (From others). Consistent with the filter bucketing
  // above. Fix shipped 2026-05-25.
  const totalGiftAmount = allVisible.reduce((sum, item) => {
    if (mapItemToCategory(item) !== "gift") return sum;
    const n = parseAmount(item.amount);
    return sum + (n != null && n > 0 ? n : 0);
  }, 0);
  const giftCount = allVisible.filter(i => mapItemToCategory(i) === "gift").length;
  const investCount = allVisible.filter(i => ["auto", "growth"].includes(mapItemToCategory(i))).length;
  // Portfolio (sells / withdrawals / bank-account mechanics) is empty for the
  // vast majority of funds — a kid's fund doesn't sell or withdraw until much
  // later (often the at-18 handoff). So only show the Portfolio pill when there
  // is actually portfolio activity to filter to; otherwise it's another
  // "click → nothing" empty-state-on-a-promise. The rows still live under "All".
  const hasGrowthRows = allVisible.some(i => mapItemToCategory(i) === "growth");

  const cachedVisible = useMemo(() => {
    // Same paired-gift dedupe as the live feed — prevents a brief flash of
    // duplicate rows when local cache hydrates before live activities arrive.
    const cached = cachedActivities as FeedActivity[];
    const cachedReceivedGiftIds = new Set<string>();
    for (const a of cached) {
      if (normalizeActivityType(a?.type) !== "gift_received") continue;
      const meta = parseMetadata((a as any).metadata);
      const gid = typeof meta.giftId === "string" ? meta.giftId : null;
      if (gid) cachedReceivedGiftIds.add(gid);
    }
    return cached.filter(item => {
      const t = normalizeActivityType(item?.type);
      if (isInternalOnlyType(t) || t.startsWith("lifecycle_")) return false;
      if (t === "gift_invested") {
        const meta = parseMetadata((item as any).metadata);
        const gid = typeof meta.giftId === "string" ? meta.giftId : null;
        if (gid && cachedReceivedGiftIds.has(gid)) return false;
      }
      return true;
    });
  }, [cachedActivities]);
  const cachedGiftCount = cachedVisible.filter(i => mapItemToCategory(i) === "gift").length;
  const cachedTotalGiftAmt = cachedVisible.reduce((sum, item) => {
    if (mapItemToCategory(item) !== "gift") return sum;
    const n = parseAmount(item.amount);
    return sum + (n != null && n > 0 ? n : 0);
  }, 0);

  const { displayValue: displayGiftCount } = useCachedFirstNumber({ seedValue: cachedGiftCount, liveValue: giftCount, minDelta: 1 });
  const { displayValue: displayTotalGiftAmt } = useCachedFirstNumber({ seedValue: cachedTotalGiftAmt, liveValue: totalGiftAmount, minDelta: 1 });

  const hasActivity = allVisible.length > 0;

  // ===== SUMMARY PERIOD SELECTOR =====
  // Top-of-history money summary defaults to "Last 30 days" (the daily-use
  // case: did the gift settle, what hit my fund this week). Year options
  // unlock the tax/reconciliation use case: "what did I pay for Kiddo+
  // last year, what did Emma's fund receive in 2025." The same four metric
  // tiles render under any period; year mode also surfaces subscription
  // and refund totals because those matter for year-end reconciliation.
  type SummaryPeriod = string;
  const currentYear = new Date().getFullYear();
  const summaryOptions = useMemo(() => {
    // Earliest year in the feed bounds the dropdown — we don't show "2018"
    // when the fund only goes back to 2024.
    let earliestYear = currentYear;
    for (const a of allVisible) {
      const d = parseSafeDate(a.createdAt);
      if (d) earliestYear = Math.min(earliestYear, d.getUTCFullYear());
    }
    const opts: { value: SummaryPeriod; label: string }[] = [
      { value: "last30", label: "Last 30 days" },
    ];
    for (let y = currentYear; y >= earliestYear; y--) {
      opts.push({ value: `year-${y}`, label: y === currentYear ? `${y} to date` : `${y}` });
    }
    return opts;
  }, [allVisible, currentYear]);
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("last30");
  const summaryRange = useMemo(() => {
    if (summaryPeriod === "last30") {
      return {
        startMs: Date.now() - 30 * 24 * 60 * 60 * 1000,
        endMs: Date.now(),
        isYear: false,
        year: null as number | null,
      };
    }
    const m = summaryPeriod.match(/^year-(\d{4})$/);
    if (m) {
      const y = Number(m[1]);
      return {
        startMs: Date.UTC(y, 0, 1, 0, 0, 0, 0),
        endMs: Date.UTC(y + 1, 0, 1, 0, 0, 0, 0) - 1,
        isYear: true,
        year: y,
      };
    }
    return { startMs: 0, endMs: Date.now(), isYear: false, year: null as number | null };
  }, [summaryPeriod]);

  // ===== 30-DAY MONEY SUMMARY (History tab) =====
  // Walks the unfiltered feed for the last 30 days and aggregates the flow
  // types shown in the "feel it working" card.
  //
  // Math correctness rules (the previous version got these wrong and produced
  // numbers that didn't reconcile with Dashboard):
  //   1. Each gift produces TWO activities — gift_received (inbound) AND
  //      gift_invested (status change to invested). Summing both = double
  //      counting. Only count the INBOUND event.
  //   2. large_gift_hold_started is the inbound for large gifts; the
  //      _released companion is just a status change to invested. Same rule.
  //   3. refund is OUTBOUND (money leaves), not income.
  //   4. Parent's own gifts (gift_received with metadata.isParentContribution)
  //      should bucket under parent contributions, not "Gifts received from
  //      others." Mirrors Dashboard's bucketing exactly.
  //   5. parent_contribution activities are recurring schedule fires.
  //      cash_invested is parent investing existing cash balance (also a
  //      parent action). Both bucket under "Your contributions."
  //   6. The auto_invest type has TWO meanings — manual "invest cash from
  //      balance" (with amount, real flow) AND schedule update/cancel (no
  //      amount, no flow). The reducer naturally drops the no-amount cases.
  const ownerEmailLower = String((user as any)?.email || "").trim().toLowerCase();
  // Filter once on the active period so every reducer below sees the same
  // window. Variable kept named `last30` to avoid touching dozens of callers,
  // but it now reflects whatever period the user selected from the dropdown.
  const last30 = allVisible.filter((item) => {
    const d = parseSafeDate(item.createdAt);
    if (!d) return false;
    const t = d.getTime();
    return t >= summaryRange.startMs && t <= summaryRange.endMs;
  });
  // Helpers — distinguish parent's own gift_received from external gifters'.
  // The server now enriches each gift activity with `isParentContribution` and
  // `senderEmail` resolved from the gift row itself, so older activities
  // (pre-metadata-rich-webhook) still bucket correctly. Falls back to local
  // metadata parsing for activities the server enrichment missed (no giftId).
  const isParentGift = (item: typeof last30[number]): boolean => {
    // Positive signals only — never short-circuit on `false`. The previous
    // version returned early on `enriched.isParentContribution === false`,
    // which silently excluded any row where the server enriched the field
    // as false but the senderEmail still matched the owner. Same bug pattern
    // existed for the senderEmail check returning the comparison result
    // (a non-match exited before the metadata fallback could run). Now any
    // positive signal — flag at either level OR senderEmail match at either
    // level — wins. Only "no positive evidence" returns false.
    const enriched = item as any;
    if (enriched.isParentContribution === true) return true;
    const meta = parseMetadata((item as any).metadata);
    if (meta.isParentContribution === true) return true;
    if (ownerEmailLower) {
      const enrichedEmail = typeof enriched.senderEmail === "string"
        ? enriched.senderEmail.trim().toLowerCase()
        : "";
      const metaEmail = typeof meta.senderEmail === "string"
        ? String(meta.senderEmail).trim().toLowerCase()
        : "";
      if (enrichedEmail === ownerEmailLower) return true;
      if (metaEmail === ownerEmailLower) return true;
    }
    return false;
  };

  // "Gifts received" = inbound from EXTERNAL gifters only.
  const last30GiftsIn = last30.reduce((s, i) => {
    const t = normalizeActivityType(i.type);
    if (t !== "gift_received" && t !== "gift_received_cash" && t !== "large_gift_hold_started") return s;
    if (isParentGift(i)) return s; // parent's own gift_received → "Your contributions"
    const n = parseAmount(i.amount);
    return s + (n != null && n > 0 ? n : 0);
  }, 0);

  // "Your contributions" = NEW money the parent put into the fund this month.
  // Matches Dashboard's "Your auto-invest + Your one-time additions" combined.
  //
  // Critical exclusion: cash_invested is NOT a contribution — it's money that
  // was already in the fund (as cash, e.g., from a held gift) being moved
  // into holdings. Counting it would double-count the gift that originally
  // produced the cash. Same with auto_invest (the act of allocation) and
  // gift_invested (gift's status change).
  const last30YourContributions = last30.reduce((s, i) => {
    const t = normalizeActivityType(i.type);
    // parent_contribution = recurring schedule firing (real new money in)
    const isRecurringFire = t === "parent_contribution";
    // gift_received from the parent themselves = one-time contribution
    const isParentOneTime = (t === "gift_received" || t === "gift_received_cash") && isParentGift(i);
    if (!isRecurringFire && !isParentOneTime) return s;
    const n = parseAmount(i.amount);
    return s + (n != null && n > 0 ? n : 0);
  }, 0);

  // Withdrawals + refunds (both money leaving the fund).
  const last30Withdrawals = last30.reduce((s, i) => {
    const t = normalizeActivityType(i.type);
    if (t !== "withdrawal" && t !== "refund") return s;
    const n = parseAmount(i.amount);
    return s + (n != null && n > 0 ? Math.abs(n) : 0);
  }, 0);

  // Market growth over the selected window, from the fund's snapshot history
  // (fundHistory above) — NOT the activity feed, which has no "growth" event.
  // (value − basis) is the unrealized market gain at any point, so the change
  // in that gain between the window's start and end is the market movement
  // during it, with every contribution in the window netted out by the basis
  // term. Works for "Last 30 days" and each year option; 0 when there isn't
  // enough history to bound the window. Same methodology as the Dashboard
  // "fund so far" card, just over the selected period instead of all-time.
  const last30MarketGrowth = (() => {
    if (!Array.isArray(fundHistory) || fundHistory.length < 2) return 0;
    const pts = fundHistory
      .map((p) => ({ ms: new Date(p.snapshotDate).getTime(), gain: parseFloat(p.totalValue) - parseFloat(p.principalBasis) }))
      .filter((p) => Number.isFinite(p.ms) && Number.isFinite(p.gain))
      .sort((a, b) => a.ms - b.ms);
    if (pts.length < 2) return 0;
    const { startMs, endMs } = summaryRange;
    // Gain at an arbitrary time, INTERPOLATED between the bracketing
    // snapshots (founder catch 2026-06-04: "this all seems ways off").
    // The old backward-snap ("latest snapshot at/before startMs") silently
    // STRETCHED the window when snapshots are sparse: with monthly
    // snapshots, "Last 30 days" anchored to Apr 30 and reported ~35 days
    // of growth under a 30-day label — and disagreed visibly with the
    // Dashboard chart's range stat. Linear interpolation pro-rates the
    // boundary months so the window means what it says regardless of
    // snapshot density. Before the first snapshot, gain was 0 (no
    // holdings); past the last, it's the latest known.
    const gainAt = (ms: number): number => {
      if (ms <= pts[0].ms) return 0;
      if (ms >= pts[pts.length - 1].ms) return pts[pts.length - 1].gain;
      for (let i = pts.length - 1; i >= 0; i--) {
        if (pts[i].ms <= ms) {
          const a = pts[i];
          const b = pts[i + 1];
          if (!b || b.ms === a.ms) return a.gain;
          const frac = (ms - a.ms) / (b.ms - a.ms);
          return a.gain + (b.gain - a.gain) * frac;
        }
      }
      return 0;
    };
    return gainAt(endMs) - gainAt(startMs);
  })();

  // Count enrichment for the 30-day summary cards. Dollars answer "how
  // much"; counts answer "from how many people" and "how many events." The
  // human warmth dollars can't carry — `$875 from 4 people across 5 gifts`
  // tells a different story than the bare amount. Each count rule mirrors
  // its dollar reducer above: skip parent gifts when counting external
  // gifters, skip cash_invested under your contributions, etc.
  //
  // Anonymous-as-distinct-human rule: matches Memory Book — each anonymous
  // gift counts as a separate person (the kid at 18 doesn't see "1
  // anonymous"; she sees N strangers who cared). Named senders dedupe on
  // lowercased email/name.
  const last30Gifts = last30.filter((i) => {
    const t = normalizeActivityType(i.type);
    if (t !== "gift_received" && t !== "gift_received_cash" && t !== "large_gift_hold_started") return false;
    return !isParentGift(i);
  });
  const last30GiftsCount = last30Gifts.length;
  const last30ContributorsCount = (() => {
    const distinct = new Set<string>();
    for (const i of last30Gifts) {
      const meta = parseMetadata((i as any).metadata);
      const enriched = i as any;
      const senderEmail = typeof enriched.senderEmail === "string" && enriched.senderEmail
        ? enriched.senderEmail
        : typeof (meta as any).senderEmail === "string" ? (meta as any).senderEmail : "";
      const senderName = typeof (meta as any).senderName === "string" ? (meta as any).senderName : "";
      const isAnon = !senderEmail && (!senderName || /^someone who loves|^anonymous$/i.test(senderName.trim()));
      if (isAnon) {
        // Each anonymous gift = a distinct human, keyed by the activity id
        // so two anon gifts don't collapse to one bucket.
        distinct.add(`anon:${i.id || Math.random()}`);
      } else if (senderEmail) {
        distinct.add(`email:${senderEmail.trim().toLowerCase()}`);
      } else {
        distinct.add(`name:${senderName.trim().toLowerCase()}`);
      }
    }
    return distinct.size;
  })();
  const last30YourContributionsCount = last30.filter((i) => {
    const t = normalizeActivityType(i.type);
    const isRecurringFire = t === "parent_contribution";
    const isParentOneTime = (t === "gift_received" || t === "gift_received_cash") && isParentGift(i);
    return isRecurringFire || isParentOneTime;
  }).length;
  const last30WithdrawalsCount = last30.filter((i) => {
    const t = normalizeActivityType(i.type);
    return t === "withdrawal" || t === "refund";
  }).length;

  // Year-mode-only metrics — surface subscription billing + refunds as
  // their own lines because year-end is when those reconcile against bank
  // statements + tax workpapers. Stays computed in the 30-day case too
  // (cheap), but only rendered when summaryRange.isYear is true.
  const periodSubscriptionPaid = last30.reduce((s, i) => {
    const t = normalizeActivityType(i.type);
    if (t !== "subscription_renewal" && t !== "subscription_started" &&
        t !== "starter_plan_activated" && t !== "family_plan_activated") return s;
    const n = parseAmount(i.amount);
    return s + (n != null && n > 0 ? n : 0);
  }, 0);
  const periodSubscriptionCount = last30.filter((i) => {
    const t = normalizeActivityType(i.type);
    return t === "subscription_renewal" || t === "subscription_started" ||
           t === "starter_plan_activated" || t === "family_plan_activated";
  }).length;
  const periodRefunds = last30.reduce((s, i) => {
    const t = normalizeActivityType(i.type);
    if (t !== "refund") return s;
    const n = parseAmount(i.amount);
    return s + (n != null && n > 0 ? n : 0);
  }, 0);
  const periodRefundsCount = last30.filter((i) => normalizeActivityType(i.type) === "refund").length;

  // ===== PENDING TAB DATA =====
  // In-transit: feed items still flagged pending or processing.
  const pendingFromFeed = (activities as FeedActivity[]).filter((item) => {
    const status = String(item.status || "").toLowerCase();
    if (status !== "pending" && status !== "processing") return false;
    const t = normalizeActivityType(item?.type);
    return !isInternalOnlyType(t) && !t.startsWith("lifecycle_");
  });
  // Upcoming soon: parent contributions whose next run date falls within the window.
  const upcomingWindowMs = Date.now() + PENDING_UPCOMING_DAYS * 24 * 60 * 60 * 1000;
  const upcomingContribs = scheduledContribs.filter((c: any) => {
    if (c.status !== "active" || !c.nextRunDate) return false;
    const next = new Date(c.nextRunDate).getTime();
    return Number.isFinite(next) && next > 0 && next <= upcomingWindowMs;
  });
  const pendingTotalCount = pendingFromFeed.length + upcomingContribs.length;

  // ===== SCHEDULED TAB DATA =====
  const scheduledTotalCount = scheduledContribs.length + scheduledReminders.length;

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-activity">
      <AppHeader />
      <main className="kiddo-canvas px-4 py-5 md:py-6">

        {/* Activity hero strip — added 2026-05-25 per
            project_secondary_page_polish_pattern.md.
            The prior comment block here said 'sibling pages (Dashboard,
            Memory Book, Account) don't repeat their title in-page' as the
            justification for removing the H1. That comment was correct
            at the time but became stale once Settings + Account were
            polished with hero strips this session — leaving Activity as
            the only secondary page WITHOUT a sense-of-place strip.
            Aligned now to match the polish pattern. Activity is the
            ACCOUNT-GLOBAL surface (cross-fund) so the headline doesn't
            name a specific child; the 1-line context names the three
            sub-views and the inverse link points at Dashboard. Same
            quiet register as Settings + Account: eyebrow + h1 + 1-line
            context, 400ms / 6px / out-expo entrance. */}
        {/* Hero copy fix 2026-05-25: was 'History, pending, and scheduled
            — across every fund' which was FACTUALLY WRONG. Activity is
            per-fund-scoped (filters via activeFundIdForActivity at line
            833). The 'across every fund' phrasing got copied from the
            Account hero's framing and slipped past review. Honest copy
            now: Activity reflects whichever fund is active in the
            AppHeader switcher. Per-fund context comes through the
            AppHeader's fund chip; the hero just anchors the page. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="px-1 mb-6"
          data-testid="activity-hero"
        >
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
            Activity
          </p>
          <h1 className="mt-1 font-heading text-2xl md:text-3xl font-semibold text-foreground leading-tight" data-testid="heading-activity">
            Your activity
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            History, pending, and scheduled for this fund.{" "}
            <Link href="/dashboard" className="underline underline-offset-2 hover:text-foreground">
              Back to Dashboard →
            </Link>
          </p>
        </motion.div>

        {/* "Needs your attention" — open action items derived
            server-side from current user + fund state. Sits ABOVE
            the History/Pending/Scheduled tabs because these are
            todos: the parent shouldn't have to switch tabs to find
            them, and the items persist through tab switches. Each
            card has a Fix CTA + Remind tomorrow snooze. */}
        {scopedActionItems.length > 0 && (
          <div className="mb-5">
            {/* maxVisible=2 added 2026-05-19 — Activity is a feed, not
                a todo list. An unbounded "verify identity + set up
                successor + thank gifter + 5 more" stack at the top of
                the feed reads as nag spam. Cap at the 2 most urgent
                items; everything else rolls into "N more in your
                inbox" linking to the notifications panel where the
                full list lives. */}
            <ActionItemList items={scopedActionItems} heading="Needs your attention" maxVisible={2} />
          </div>
        )}

        {/* Three-tab control: History · Pending · Scheduled. Past · present · future. The
            primary navigation primitive for everything money-flow. */}
        <div
          role="tablist"
          aria-label="Activity sections"
          style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4,
            background: "rgba(26,23,16,0.05)", borderRadius: 12, padding: 4,
            marginBottom: 20,
          }}
          data-testid="activity-tabs"
        >
          {[
            { id: "history" as const, label: "History" },
            { id: "pending" as const, label: "Pending", count: pendingTotalCount },
            { id: "scheduled" as const, label: "Scheduled", count: scheduledTotalCount },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { haptic("selection"); setTab(t.id); }}
                data-testid={`tab-${t.id}`}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  height: 36, borderRadius: 9, border: "none",
                  background: active ? "white" : "transparent",
                  boxShadow: active ? "0 1px 3px rgba(26,23,16,0.1)" : "none",
                  color: active ? "rgb(26,67,50)" : "rgba(26,23,16,0.55)",
                  fontSize: 13, fontWeight: active ? 700 : 600,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
                }}
              >
                {/* In owner mode the "Yours" filter actually surfaces the
                    parent's custodial contributions, not the owner's — relabel
                    so it doesn't claim them as the owner's. */}
                {activeFundIsOwned && t.label === "Yours" ? "Contributions" : t.label}
                {t.count != null && t.count > 0 && (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 18, height: 18, borderRadius: 9,
                      padding: "0 5px", fontSize: 10, fontWeight: 800,
                      background: active ? "rgb(26,67,50)" : "rgba(26,23,16,0.15)",
                      color: active ? "white" : "rgba(26,23,16,0.65)",
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ============================ HISTORY TAB ============================ */}
        {/* Tab fade-ins added 2026-05-25 per the secondary-page polish
            pattern. Each branch wraps in motion.div with a unique key
            so the entrance animation fires on tab switch. 280ms/6px/
            out-expo register matches Settings + Account. */}
        {tab === "history" && (
          <motion.div
            key="activity-tab-history"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >

        {/* 30-day money summary — replaces the old 3-stat row. The "feel it working"
            moment at the top of every Activity visit. */}
        {hasActivity && (
          <EnlighteningReveal>
            <div
              className="kiddo-card"
              style={{
                padding: "16px 18px",
                marginBottom: 20,
              }}
              data-testid="last-30-summary"
            >
              {/* Period selector — defaults to "Last 30 days" (daily-use
                  case). Year options unlock the tax/reconciliation use
                  case. The same four metric tiles re-render under any
                  period; year mode adds subscription + refund rows below. */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgb(140,130,122)" }}>
                  Money summary
                  {/* All-time anchor (2026-06-04): a quiet 30-day window on a
                      worn fund ("3 gifts") read as a bug against a 134-gift
                      lifetime — founder hit exactly this. One muted count
                      keeps the narrow lens from looking broken. Rendered
                      only when the lifetime story is meaningfully bigger
                      than the window's. */}
                  {(() => {
                    const allTimeGifts = allVisible.filter((i) => {
                      const t = normalizeActivityType(i.type);
                      if (t !== "gift_received" && t !== "gift_received_cash" && t !== "large_gift_hold_started") return false;
                      return !isParentGift(i);
                    }).length;
                    return allTimeGifts > Math.max(last30GiftsCount * 2, 5) ? (
                      <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: "none", color: "rgba(140,130,122,0.8)" }}>
                        {" "}· {allTimeGifts.toLocaleString("en-US")} gifts all-time
                      </span>
                    ) : null;
                  })()}
                </p>
                <select
                  value={summaryPeriod}
                  onChange={(e) => { haptic("selection"); setSummaryPeriod(e.target.value); }}
                  data-testid="summary-period-select"
                  aria-label="Choose summary period"
                  style={{
                    fontSize: 11.5, fontWeight: 700, color: "rgb(26,67,50)",
                    background: "rgba(26,67,50,0.06)",
                    border: "1px solid rgba(26,67,50,0.18)",
                    borderRadius: 999, padding: "4px 10px",
                    cursor: "pointer", fontFamily: "inherit",
                    appearance: "none" as const,
                    paddingRight: 24,
                    backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' stroke='rgb(26,67,50)' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 8px center",
                    backgroundSize: "10px",
                  }}
                >
                  {summaryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px 16px" }}>
                {[
                  // Labels match the Dashboard's "fund so far" card so the
                  // user reads the same vocabulary on both surfaces.
                  // "Gifts from others" / "Your contributions" mirror the
                  // Dashboard split exactly. Each metric carries an
                  // optional `meta` line — counts that answer "how many"
                  // alongside the dollars that answer "how much." Only
                  // rendered when meaningful (positive count) to keep
                  // the section clean when empty.
                  {
                    label: "Gifts from others",
                    value: formatCurrency(last30GiftsIn),
                    tone: last30GiftsIn > 0 ? "positive" : "neutral",
                    meta: last30GiftsCount > 0
                      ? `${last30ContributorsCount} ${last30ContributorsCount === 1 ? "person" : "people"} · ${last30GiftsCount} ${last30GiftsCount === 1 ? "gift" : "gifts"}`
                      : null,
                  },
                  {
                    label: "You added",
                    value: formatCurrency(last30YourContributions),
                    tone: "neutral" as const,
                    meta: last30YourContributionsCount > 0
                      ? `${last30YourContributionsCount} ${last30YourContributionsCount === 1 ? "contribution" : "contributions"}`
                      : null,
                  },
                  {
                    label: "Withdrawals",
                    value: last30Withdrawals > 0 ? `−${formatCurrency(last30Withdrawals)}` : formatCurrency(0),
                    tone: last30Withdrawals > 0 ? "negative" : "neutral",
                    meta: last30WithdrawalsCount > 0
                      ? `${last30WithdrawalsCount} ${last30WithdrawalsCount === 1 ? "withdrawal" : "withdrawals"}`
                      : null,
                  },
                  {
                    // Market growth over the selected window, computed from the
                    // fund's snapshot history (last30MarketGrowth above): value
                    // change minus contributions, i.e. pure market movement.
                    // Sign handled manually (formatCurrency on the magnitude) to
                    // match the Withdrawals tile and render a clean −$ in a down
                    // window. Shown in both last30 and year modes.
                    label: "Market growth",
                    value: `${last30MarketGrowth >= 0 ? "+" : "−"}${formatCurrency(Math.abs(last30MarketGrowth))}`,
                    tone: last30MarketGrowth >= 0 ? "positive" : "negative",
                    meta: null,
                  },
                  // Year-mode-only rows. Subscription paid (Kiddo+ / Family
                  // billing total) and refunds received — both surface here
                  // because they're the lines a parent needs at tax time
                  // and during reconciliation. Skipped for last30 to keep
                  // the daily-use card focused.
                  ...(summaryRange.isYear ? [
                    {
                      label: "Kiddo billing",
                      value: periodSubscriptionPaid > 0 ? `−${formatCurrency(periodSubscriptionPaid)}` : formatCurrency(0),
                      tone: (periodSubscriptionPaid > 0 ? "negative" : "neutral") as "negative" | "neutral" | "positive",
                      meta: periodSubscriptionCount > 0
                        ? `${periodSubscriptionCount} ${periodSubscriptionCount === 1 ? "charge" : "charges"}`
                        : "No charges this period",
                    },
                    {
                      label: "Refunds",
                      value: periodRefunds > 0 ? `−${formatCurrency(periodRefunds)}` : formatCurrency(0),
                      tone: (periodRefunds > 0 ? "negative" : "neutral") as "negative" | "neutral" | "positive",
                      meta: periodRefundsCount > 0
                        ? `${periodRefundsCount} ${periodRefundsCount === 1 ? "refund" : "refunds"}`
                        : "No refunds this period",
                    },
                  ] : []),
                ].map(({ label, value, tone, meta }) => {
                  // The "You added" tile is the entry point into the
                  // contributions detail modal — tap to see every dollar
                  // you've added (recurring + one-time, with sub-toggle).
                  // Other tiles stay non-interactive: tapping "Gifts from
                  // others" opening another modal would bury the Memory
                  // Book story for community gifts; that's where it lives.
                  const isContribTile = label === "You added";
                  const inner = (
                    <>
                      <p style={{ fontSize: 10.5, fontWeight: 600, color: "rgb(140,130,122)", marginBottom: 2 }}>
                        {label}
                        {isContribTile && (
                          <History
                            size={10}
                            style={{ display: "inline-block", marginLeft: 5, verticalAlign: "middle", color: "rgb(140,130,122)" }}
                          />
                        )}
                      </p>
                      <p
                        className="font-heading"
                        style={{
                          fontSize: 16, fontWeight: 700, lineHeight: 1.2,
                          color: tone === "positive" ? "rgb(26,67,50)" : tone === "negative" ? "rgb(185,28,28)" : "rgb(26,23,16)",
                        }}
                      >
                        {value}
                      </p>
                      {meta && (
                        <p style={{ fontSize: 10.5, color: "rgb(155,144,136)", marginTop: 3, lineHeight: 1.3 }}>
                          {meta}
                        </p>
                      )}
                    </>
                  );
                  if (isContribTile) {
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => openDetailScope({ kind: "contributions" })}
                        data-testid="tile-your-contributions"
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          textAlign: "left" as const,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          borderRadius: 8,
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(26,67,50,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {inner}
                      </button>
                    );
                  }
                  return <div key={label}>{inner}</div>;
                })}
              </div>
            </div>
          </EnlighteningReveal>
        )}

        {/* Existing summary 3-stat block — kept hidden behind a no-op false guard
            for now so the design isn't shown twice. Removed in a future pass. */}
        {false && hasActivity && (
          <EnlighteningReveal>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total received", value: formatCurrency(Number.isFinite(displayTotalGiftAmt) ? displayTotalGiftAmt : 0) },
                { label: "Gifts",          value: String(Math.round(displayGiftCount)) },
                { label: "Invested",       value: String(investCount) },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: "white", borderRadius: 16,
                  border: "1px solid rgba(26,23,16,0.09)",
                  boxShadow: "0 1px 4px rgba(26,23,16,0.05)",
                  padding: "14px 16px",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "rgb(140,130,122)", marginBottom: 5 }}>
                    {label}
                  </p>
                  <p className="font-heading" style={{ fontSize: 20, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1 }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </EnlighteningReveal>
        )}

        {/* Search + filter */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgb(175,164,156)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search activity..."
              // 16px font-size on mobile is the canonical iOS-Safari fix for
              // "input gains focus → page auto-zooms → user loses position."
              // We use Tailwind's text-base on phones + text-sm at sm: breakpoint
              // so the desktop look stays compact (matches the Input primitive's
              // pattern). Inline fontSize removed because it would override the
              // class. Other inline styles stay — they don't have media-query
              // equivalents.
              className="text-base sm:text-sm"
              style={{
                width: "100%", padding: "10px 12px 10px 34px",
                border: "1.5px solid rgba(26,23,16,0.12)", borderRadius: 12,
                color: "rgb(26,23,16)", background: "white",
                outline: "none", boxSizing: "border-box" as const,
                fontFamily: "inherit",
              }}
              onFocus={e => (e.target.style.borderColor = "rgb(26,61,43)")}
              onBlur={e => (e.target.style.borderColor = "rgba(26,23,16,0.12)")}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto" as const, paddingBottom: 2, flex: 1, minWidth: 0 }} data-testid="filter-pills">
            {filterOptions.filter(opt => opt.value !== "growth" || hasGrowthRows).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { haptic("selection"); setFilter(opt.value); }}
                data-testid={`filter-${opt.value}`}
                style={{
                  padding: "7px 16px", borderRadius: 999, flexShrink: 0,
                  border: filter === opt.value ? "none" : "1.5px solid rgba(26,23,16,0.12)",
                  background: filter === opt.value ? "rgb(26,61,43)" : "white",
                  color: filter === opt.value ? "white" : "rgb(100,92,86)",
                  fontSize: 12.5, fontWeight: filter === opt.value ? 700 : 500,
                  cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
                }}
              >
                {/* Owner mode: the "auto" bucket holds the parent's pre-handoff
                    contributions (now labeled "Dad added") plus the owner's own
                    since handoff — so "Yours" is wrong here. "Contributions" is
                    neutral + accurate, matching the contributions-detail modal. */}
                {activeFundIsOwned && opt.value === "auto" ? "Contributions" : opt.label}
              </button>
            ))}
            </div>
            {/* Export CSV — quiet button next to the filter pills. Exports
                the currently filtered view (so a parent searching "googl"
                exports only the matching rows). Hidden when there's
                nothing visible to export. */}
            {filtered.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                title="Download current view as CSV"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  flexShrink: 0,
                  padding: "6px 10px",
                  background: "rgba(26,61,43,0.06)",
                  border: "1px solid rgba(26,61,43,0.18)",
                  borderRadius: 999,
                  color: "rgb(26,61,43)",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                data-testid="button-export-csv"
              >
                <ArrowUp size={11} style={{ transform: "rotate(180deg)" }} />
                CSV
              </button>
            )}
          </div>
        </div>

        {/* Loading. Uses the shared KiddoSkeleton list-row variant so the
            placeholder shape MATCHES the post-load activity row shape (icon
            tile + title line + meta line). Premium-app rule: skeletons are
            specific previews of what's about to appear, not generic gray
            blocks. Five rows is the typical above-the-fold count. */}
        {feedLoading && (
          <div
            className="kiddo-card"
            style={{ padding: "16px 18px" }}
            role="status"
            aria-label="Loading activity"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <KiddoSkeleton key={i} variant="list-row" />
              ))}
            </div>
          </div>
        )}

        {/* Error — first sentence is the locked safety pattern. Pulls the
            child's first name from any available cached activity (the feed
            hasn't loaded but our local cache may have it from a prior
            visit), falls back to a fund-aware generic when not. The order
            matters: safety statement FIRST, then "couldn't load," then
            retry. Per feedback_emmas_fund_is_safe_error_pattern.md:
            "the parent's first instinct is panic; the first sentence has
            to be safety, not the failure." */}
        {!feedLoading && feedError && (() => {
          const cachedKidName = (cachedActivities[0] as any)?.recipientFirstName
            || (filtered[0] as any)?.recipientFirstName
            || null;
          const firstFundId = String((cachedActivities[0] as any)?.fundId || (filtered[0] as any)?.fundId || "");
          const safetyLine = cachedKidName && !ownerModeFundIds.has(firstFundId)
            ? `${cachedKidName}'s fund is safe.`
            : "Your fund is safe.";
          return (
            <div className="kiddo-card" style={{ padding: 20 }} data-testid="activity-error-state">
              <p style={{ fontSize: 14, fontWeight: 700, color: "rgb(26,67,50)", marginBottom: 4 }}>{safetyLine}</p>
              <p style={{ fontSize: 13, color: "rgb(140,130,122)", marginBottom: 12 }}>The activity feed couldn't load right now. Try again in a moment.</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()} data-testid="button-retry-activity">
                Retry
              </Button>
            </div>
          );
        })()}

        {/* Empty state — uses the unified <EmptyState> primitive
            (client/src/components/ui/empty-state.tsx, built 2026-05-25
            from the team-audit visual-system recommendation). Previous
            implementation hand-rolled the card with inline styles +
            rgb literals; now uses the shared component so Activity +
            MemoryBook + Settings all share one visual language for
            empty list states. Same copy, same behavior, same
            filter-aware variant — the action button only renders in
            the unfiltered case where "go to dashboard" makes sense. */}
        {!feedLoading && !feedError && filtered.length === 0 && (
          <EnlighteningReveal>
            <EmptyState
              icon={BookOpen}
              align="center"
              title={search || filter !== "all" ? "No activity matches this filter." : "Nothing here yet."}
              description={
                search || filter !== "all"
                  ? "Try a different filter or search term."
                  : "Gifts, contributions, and fund updates show up here. Share the gift link to get started."
              }
              action={
                !search && filter === "all" ? (
                  <Button onClick={() => { haptic("selection"); navigate("/dashboard"); }} data-testid="button-activity-empty-go-dashboard">
                    Go to dashboard
                  </Button>
                ) : undefined
              }
              testId="activity-empty-state"
            />
          </EnlighteningReveal>
        )}

        {/* Results hint when filtering */}
        {!feedLoading && !feedError && (search || filter !== "all") && filtered.length > 0 && (
          <p style={{ fontSize: 12, color: "rgb(140,130,122)", marginBottom: 12 }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            {search && <> matching "<strong style={{ color: "rgb(26,23,16)" }}>{search}</strong>"</>}
          </p>
        )}

        {/* Onboarding thread — when a fund is new (created within the last
            45 days) AND we can detect setup steps in the activity feed,
            surface them in a single "Setting up Emma's fund" card at the
            top of History. Lets a new user see the journey as a coherent
            story instead of as 6+ chronologically-mixed rows of equal
            weight. Auto-fades once the fund matures past the window. */}
        {!feedLoading && !feedError && filter === "all" && !search && (() => {
          const onboardingTypes: Record<string, { icon: string; label: string }> = {
            fund_created: { icon: "🌱", label: "Fund created" },
            child_profile_updated: { icon: "👤", label: "Profile completed" },
            ssn_provided: { icon: "🆔", label: "Tax ID added" },
            kyc_approved: { icon: "🛡", label: "Identity verified" },
            kyc_pending_review: { icon: "🛡", label: "Identity submitted" },
            successor_custodian_added: { icon: "🤝", label: "Successor named" },
            bank_linked: { icon: "🏦", label: "Bank linked" },
          };
          // Find the fund_created activity to anchor "fund age."
          const fundCreated = (activities as FeedActivity[]).find(
            (a) => normalizeActivityType(a?.type) === "fund_created",
          );
          if (!fundCreated || !fundCreated.createdAt) return null;
          const ageDays = (Date.now() - new Date(fundCreated.createdAt).getTime()) / (24 * 60 * 60 * 1000);
          if (ageDays > 45) return null;
          // Collect completed onboarding steps in CHRONOLOGICAL order so
          // checklist reads like the journey actually went.
          const completedTypes: string[] = [];
          const seen = new Set<string>();
          const sorted = [...(activities as FeedActivity[])].sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return ta - tb;
          });
          for (const a of sorted) {
            const t = normalizeActivityType(a?.type);
            if (onboardingTypes[t] && !seen.has(t)) {
              seen.add(t);
              completedTypes.push(t);
            }
          }
          if (completedTypes.length === 0) return null;
          const childName = capFirst((fundCreated as any).recipientFirstName) || "this fund";
          return (
            <EnlighteningReveal>
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
                  textTransform: "uppercase" as const, color: "rgb(140,130,122)", marginBottom: 10,
                }}>
                  Setting up {childName}'s fund
                </p>
                <div style={{
                  background: "linear-gradient(135deg, rgb(253,250,243) 0%, rgb(247,242,235) 100%)",
                  borderRadius: 20,
                  border: "1px solid rgba(184,121,26,0.18)",
                  padding: "16px 18px",
                }} data-testid="onboarding-thread">
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    {completedTypes.map((t) => {
                      const cfg = onboardingTypes[t];
                      return (
                        <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            fontSize: 14, lineHeight: 1,
                            width: 22, height: 22, borderRadius: 999,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            background: "rgb(220,247,228)",
                            border: "1px solid rgba(15,82,42,0.20)",
                            flexShrink: 0,
                          }}>
                            <Check size={11} style={{ color: "rgb(15,82,42)" }} />
                          </span>
                          <span style={{ fontSize: 12.5, color: "rgb(60,52,42)", fontWeight: 600 }}>
                            <span style={{ marginRight: 6 }}>{cfg.icon}</span>{cfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </EnlighteningReveal>
          );
        })()}

        {/* Timeline - grouped by month */}
        {!feedLoading && !feedError && grouped.map((group, gi) => (
          // Stagger the month-group reveals so the ledger CASCADES in (one beat
          // at a time) instead of every group blurring in at once — matches the
          // dashboard/notifications arrival feel. Capped + reduced-motion-gated.
          <EnlighteningReveal key={group.label} delay={prefersReducedMotion ? 0 : Math.min(gi, 6) * 0.06}>
            <div style={{ marginBottom: 24 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
                textTransform: "uppercase" as const, color: "rgb(140,130,122)", marginBottom: 10,
              }}
                data-testid={`group-label-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {group.label}
              </p>
              <div className="kiddo-card" style={{
                padding: "0 18px",
              }}>
                {group.items.map((item, i) => {
                  // Collapsed recurring run — a self-contained, expandable
                  // summary that stands in for a stretch of identical monthly
                  // contributions. Returns before the per-row machinery below.
                  if ((item as any).type === RECURRING_RUN_TYPE) {
                    const runId = String((item as any).id);
                    return (
                      <RecurringRunRow
                        key={runId}
                        run={item}
                        isLast={i === group.items.length - 1}
                        expanded={expandedId === runId}
                        onToggle={() => { haptic("selection"); setExpandedId(expandedId === runId ? null : runId); }}
                      />
                    );
                  }
                  const rowId = String(item?.id || `${item?.createdAt || "row"}-${item?.title || "activity"}`);
                  const isExpanded = expandedId === rowId;
                  const createdAt = parseSafeDate(item.createdAt);
                  const amtNum = parseAmount(item.amount);
                  const isLast = i === group.items.length - 1;
                  // Date label is context-aware: current-year rows say
                  // "May 5"; prior-year rows append "May 5, 2024" so the
                  // ledger reads accurately when scrolling through a fund's
                  // long history. Old mockup pattern.
                  //
                  // Timezone: LOCAL (no timeZone arg) — was UTC, which
                  // caused a header/footer mismatch for evening events
                  // in non-UTC timezones. A US-Eastern parent who did a
                  // strategy change at 10pm Thursday May 14 saw the
                  // group header "Thursday, May 14" (local-time
                  // toDateString) but the row's footer date "May 15"
                  // (UTC). Both day-grouping (line 2054) and dayLabel
                  // (line 2056) use local time, so the footer must too.
                  // Locked 2026-05-18 per the date-mismatch audit.
                  const now = new Date();
                  const dateShort = createdAt
                    ? createdAt.getFullYear() === now.getFullYear()
                      ? createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : null;
                  // Day-level subheader. Renders above the row when this
                  // item's day differs from the previous item's day. Lets
                  // the eye skim a chronological wall of activity by day
                  // ("everything that happened on May 5") without breaking
                  // the existing month grouping above.
                  const prevItem = i > 0 ? group.items[i - 1] : null;
                  const prevDate = prevItem ? parseSafeDate(prevItem.createdAt) : null;
                  const isNewDay = createdAt && (!prevDate ||
                    createdAt.toDateString() !== prevDate.toDateString());
                  const dayLabel = isNewDay && createdAt
                    ? createdAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                    : null;
                  const childLabel = capFirst(item.recipientFirstName) || (item.fundName ? item.fundName.replace(/'s Fund$/i, "").replace(/ Fund$/i, "") : null);
                  const meta = parseMetadata((item as any).metadata);

                  // Render-time fallback: if this row is a parent's own gift
                  // but was stamped with the gifter type/title (any row that
                  // pre-dates the server-side parent_contribution branch, or
                  // any future row that misses the isParentContribution flag),
                  // substitute the parent_contribution treatment at render
                  // time. Defense-in-depth — server stamp at write time +
                  // render override as backstop. Costs nothing for correctly-
                  // stamped rows (the override produces identical output on
                  // those, since the type/title/desc already match).
                  const ownerEmailLowerForRow = String((user as any)?.email || "").trim().toLowerCase();
                  const itemSenderEmailRaw = typeof (item as any).senderEmail === "string"
                    ? (item as any).senderEmail
                    : (typeof (meta as any).senderEmail === "string" ? (meta as any).senderEmail : "");
                  const itemSenderEmail = String(itemSenderEmailRaw || "").trim().toLowerCase();
                  const rawType = normalizeActivityType(item.type);
                  const isGiftFamilyType =
                    rawType === "gift_received" ||
                    rawType === "gift_received_cash" ||
                    rawType === "gift_invested";
                  const overrideToParentContrib =
                    isGiftFamilyType &&
                    ((meta as any).isParentContribution === true ||
                      (!!ownerEmailLowerForRow && itemSenderEmail === ownerEmailLowerForRow));
                  const effectiveType = overrideToParentContrib ? "parent_contribution" : (item.type || null);
                  const config = getTypeConfig(effectiveType);

                  const isGiftOrContrib = GIFT_TYPES.includes(rawType) || rawType === "parent_contribution" || overrideToParentContrib;
                  const ticker = isGiftOrContrib ? extractTicker(meta, item.title) : null;
                  const giftMessage = typeof meta.message === "string" && meta.message ? meta.message : null;
                  const isFirstGift = firstGiftId === rowId;
                  // "New since you last looked" marker. Only when there is a real
                  // prior-read reference (seenBeforeArrival > 0); a first-ever
                  // visitor has no "since," so nothing is falsely flagged new.
                  const isNewSinceLastVisit = seenBeforeArrival > 0 && createdAt != null && createdAt.getTime() > seenBeforeArrival && !dismissedNewIds.has(rowId);

                  // Effective title + description — use the parent-contrib
                  // copy when the override fires; otherwise the row's own.
                  // The "Auto-invest contribution to Emma's Fund" boilerplate
                  // message gets dropped in the override path because it's
                  // less meaningful than "Investing into AAPL."
                  //
                  // See rewriteLegacyAutoInvestTitle (top of file) for
                  // why this exists. Legacy rows that pre-date the
                  // server-side rename get rewritten at display time.
                  // Owner mode (post-handoff): a parent's custodial-era
                  // contribution is NOT the owner's — never title it "You".
                  // Credit the contributor (preferred name / first name from the
                  // row, else a neutral "Your parent"). Mirrors the Dashboard's
                  // "Invested by …" framing. See project_post_handoff_*.
                  const isParentContribRow = effectiveType === "parent_contribution" || (meta as any).isParentContribution === true;
                  const ownerViewingParentContrib = activeFundIsOwned && isParentContribRow;
                  const parentContribName = (() => {
                    const c = typeof (meta as any).contributorName === "string" ? (meta as any).contributorName.trim() : "";
                    if (c) return c;
                    const sn = typeof (meta as any).senderName === "string" ? (meta as any).senderName.trim() : "";
                    return sn ? sn.split(/\s+/)[0] : "Your parent";
                  })();
                  const effectiveTitle = ownerViewingParentContrib
                    ? `${parentContribName} added $${(amtNum != null ? amtNum : 0).toFixed(2)}`
                    : overrideToParentContrib
                      ? `You added $${(amtNum != null ? amtNum : 0).toFixed(2)}`
                      : rewriteLegacyAutoInvestTitle(item.title);
                  const effectiveDescription = overrideToParentContrib
                    ? (ticker ? `Investing into ${ticker}` : "Investing across the full mix")
                    : rewriteSettlementSentence(rewriteLegacyDescription(item.description), item.createdAt);
                  // Hoisted kid-suggestion state so the Approve/Decline bar
                  // renders OUTSIDE the expanded panel (always visible on
                  // suggestion rows), not buried behind a tap. Same fields
                  // re-used inside the expanded view's suggestion box —
                  // single source of truth.
                  const collapsedNormalizedType = normalizeActivityType(item.type);
                  const isKidSuggestionCollapsed = collapsedNormalizedType === "kid_stock_suggestion";
                  const collapsedSuggestionId = isKidSuggestionCollapsed && typeof (meta as any).suggestionId === "string" ? (meta as any).suggestionId : null;
                  const collapsedSuggestionStatus = isKidSuggestionCollapsed && collapsedSuggestionId ? reviewedSuggestionIds.get(collapsedSuggestionId) ?? null : null;
                  const collapsedSuggestionLoading = reviewingSuggestionId === collapsedSuggestionId;
                  const collapsedFundIdForActivity = (item as any).fundId as string | undefined;

                  return (
                    <Fragment key={rowId}>
                      {/* First-gift celebration banner — appears once,
                          immediately before the iconic first external gift
                          row. Honors the design lens (the moment grandpa
                          first gifts is the moment Kiddo becomes real)
                          without dragging the rest of the ledger into
                          ribbon-fest. */}
                      {isFirstGift && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 12px",
                            margin: "8px -6px 6px -6px",
                            background: "linear-gradient(135deg, rgb(253,250,243) 0%, rgb(247,242,235) 100%)",
                            border: "1px solid rgba(184,121,26,0.20)",
                            borderRadius: 12,
                          }}
                          data-testid="first-gift-banner"
                        >
                          <span style={{ fontSize: 18, lineHeight: 1 }}>🎁</span>
                          <div>
                            <p style={{ fontSize: 11.5, fontWeight: 800, color: "rgb(146,108,46)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                              The first gift
                            </p>
                            <p style={{ fontSize: 11.5, color: "rgb(95,85,72)", lineHeight: 1.4 }}>
                              The moment {ownerModeFundIds.has(String((item as any).fundId)) ? "your" : `${capFirst(item.recipientFirstName) || "your child"}'s`} fund became real.
                            </p>
                          </div>
                        </div>
                      )}
                      {dayLabel && (
                        <p
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "rgb(140,130,122)",
                            letterSpacing: "0.04em",
                            margin: i === 0 ? "0 0 4px 0" : "10px 0 4px 0",
                            // First-of-month day label needs breathing room
                            // from the month header above (and the card's
                            // top edge) — the prior 4px crowded the top.
                            // Subsequent days within the same card stay
                            // tight; their separation is the inter-day
                            // 10px top margin set above.
                            paddingTop: i === 0 ? 14 : 0,
                          }}
                          data-testid={`day-label-${dayLabel.toLowerCase().replace(/[\s,]+/g, "-")}`}
                        >
                          {dayLabel}
                        </p>
                      )}
                    {/* Milestone rows get a quiet gold accent — left
                        border + tinted background — so they read as
                        moments inside the audit-ledger surface, not as
                        another transaction. Kept restrained: same
                        kiddo-gold tone as the type-config pill, no
                        animation on stale rows. Fresh milestones
                        (< 1 hour old) also pick up the
                        kiddo-milestone-celebrate breath that the
                        Memory Book uses, so the burst is consistent
                        across surfaces. The breath runs once per
                        page-load, then settles into the static
                        gold-accent treatment. */}
                    {(() => {
                      const isMilestoneRow = rawType.startsWith("milestone_");
                      const ms = item.createdAt ? new Date(String(item.createdAt)).getTime() : NaN;
                      const isFreshMilestone = isMilestoneRow && Number.isFinite(ms) && (Date.now() - ms) < 60 * 60 * 1000;
                      // Per-type row accents added 2026-05-25 Sprint 2.
                      // Pre-this-commit, only milestone rows got the
                      // left-border + gradient treatment; everything
                      // else was visually flat. A 30-second scroll
                      // through Activity read as a CSV row by row.
                      // Now each category gets a subtle row-level
                      // accent in its semantic color:
                      //   - Milestone → gold (existing, unchanged)
                      //   - Gift from others → warm-green
                      //   - Memory (note/photo/etc.) → soft purple
                      //   - Growth (sell/withdrawal/bank) → soft blue
                      //   - Parent contribution → sage (slightly
                      //     different from gift-from-others to
                      //     distinguish "you" vs "from others")
                      // Discipline: all accents are < 0.07 opacity so
                      // the differentiation is visual rhythm not
                      // peacock-feathering. The icon already carries
                      // the saturated color; the row's job is to
                      // belong to a family at a glance.
                      const rowCategory = mapItemToCategory(item);
                      const categoryAccent = (() => {
                        if (isMilestoneRow || rowCategory === "milestone") {
                          return {
                            borderLeft: "3px solid hsl(var(--kiddo-gold))",
                            background: "linear-gradient(to right, hsl(var(--kiddo-gold)/0.06) 0%, transparent 64%)",
                          };
                        }
                        if (rowCategory === "memory") {
                          return {
                            borderLeft: "3px solid rgb(155, 110, 195)",
                            background: "linear-gradient(to right, rgba(155,110,195,0.045) 0%, transparent 64%)",
                          };
                        }
                        if (rowCategory === "gift") {
                          return {
                            borderLeft: "3px solid hsl(var(--kiddo-evergreen)/0.55)",
                            background: "linear-gradient(to right, hsl(var(--kiddo-evergreen)/0.04) 0%, transparent 64%)",
                          };
                        }
                        if (rowCategory === "auto") {
                          // Parent contribution = the calm SAGE family, matching
                          // its (now actually-sage) icon. Was evergreen/0.40 — a
                          // near-twin of the gift border's evergreen/0.55, so the
                          // two greens blurred. An explicit muted sage makes "from
                          // you" read clearly distinct from "from others" (deep
                          // evergreen) on a fast scroll, without adding a 6th
                          // saturated hue. The green family is preserved; only the
                          // shade separates.
                          return {
                            borderLeft: "3px solid rgb(150,176,158)",
                            background: "linear-gradient(to right, rgba(150,176,158,0.07) 0%, transparent 64%)",
                          };
                        }
                        if (rowCategory === "growth") {
                          return {
                            borderLeft: "3px solid rgb(70, 110, 180)",
                            background: "linear-gradient(to right, rgba(70,110,180,0.035) 0%, transparent 64%)",
                          };
                        }
                        return null;
                      })();
                      return (
                        <div
                          data-testid={`activity-card-${rowId}`}
                          className={isFreshMilestone ? "kiddo-milestone-celebrate" : undefined}
                          style={{
                            margin: highlightedId === rowId ? "0 -8px" : "0",
                            padding: highlightedId === rowId ? "0 8px" : "0",
                            ...(categoryAccent ? {
                              ...categoryAccent,
                              borderRadius: 8,
                              paddingLeft: highlightedId === rowId ? 11 : 8,
                              marginLeft: -3,
                            } : {}),
                            ...getDeepLinkHighlightStyle(highlightedId === rowId),
                          }}
                        >
                      <button
                        type="button"
                        onClick={() => {
                          haptic("selection");
                          // Opening the row clears its own "New" — add-only so a
                          // later collapse can't bring the badge back this visit.
                          if (!isExpanded && isNewSinceLastVisit) {
                            setDismissedNewIds((prev) => {
                              const next = new Set(prev);
                              next.add(rowId);
                              return next;
                            });
                          }
                          setExpandedId(isExpanded ? null : rowId);
                        }}
                        data-testid={`button-expand-${rowId}`}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "13px 0",
                          borderBottom: !isLast || isExpanded ? "1px solid rgba(26,23,16,0.06)" : "none",
                          width: "100%", textAlign: "left" as const, background: "transparent", cursor: "pointer",
                        }}
                      >
                        {/* Type icon */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: config.bg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: `1px solid ${config.color}18`,
                        }}>
                          <span style={{ color: config.color, display: "flex" }}>{config.icon}</span>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            {isNewSinceLastVisit && (
                              <span
                                style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "white", background: "hsl(var(--kiddo-evergreen))", borderRadius: 6, padding: "1px 5px", marginTop: 2, lineHeight: 1.5 }}
                                data-testid={`activity-new-${rowId}`}
                              >
                                New
                              </span>
                            )}
                            <p style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.3, flex: 1, minWidth: 0 }} data-testid={`text-title-${rowId}`}>
                              {effectiveTitle}
                            </p>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              {amtNum != null && (
                                <p className="font-heading" style={{
                                  fontSize: 15, fontWeight: 700, lineHeight: 1.3,
                                  color: amtNum >= 0 ? "rgb(26,23,16)" : "rgb(185,28,28)",
                                }}>
                                  {amtNum > 0 ? "+" : ""}{formatCurrency(amtNum)}
                                </p>
                              )}
                              <motion.span
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={MOTION.fast}
                                style={{ display: "flex", color: "rgb(175,164,156)" }}
                              >
                                <ChevronDown size={14} />
                              </motion.span>
                            </div>
                          </div>

                          {/* Description inline. Override path uses the
                              parent-contrib copy ("Investing into AAPL") and
                              skips giftMessage entirely so the boilerplate
                              "Auto-invest contribution to Emma's Fund" line
                              never bubbles up. Non-override path keeps the
                              old behavior: prefer the gifter's note over the
                              default description. */}
                          {(() => {
                            const shown = overrideToParentContrib
                              ? effectiveDescription
                              : (giftMessage ? `"${giftMessage}"` : effectiveDescription);
                            if (!shown) return null;
                            return (
                              <p style={{
                                fontSize: 12.5, lineHeight: 1.45, marginTop: 3,
                                color: "rgba(26,23,16,0.55)",
                                fontStyle: shown.startsWith('"') ? "italic" : "normal",
                                // Gift notes WRAP and show in full — was nowrap+ellipsis,
                                // which cut "feliz cumpleaños…" mid-message on mobile. The
                                // notes are short and they're the heart of the feed.
                                overflowWrap: "anywhere",
                              }}>
                                {shown}
                              </p>
                            );
                          })()}

                          {/* Meta row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, flexWrap: "wrap" as const }}>
                            <StatusPill status={item.status} type={effectiveType} />
                            {/* Ticker pills in collapsed row. When metadata
                                carries multiple tickers (managed-mix gift
                                spread across positions), surface the first
                                two/three as compact pills with a "+N more"
                                affordance — old-mockup parity for at-a-
                                glance "where did this go" without forcing
                                an expand. Single-ticker case keeps the
                                existing solo pill. */}
                            {(() => {
                              const metaTickers: string[] = Array.isArray((meta as any).tickers)
                                ? ((meta as any).tickers as unknown[]).filter((x): x is string => typeof x === "string" && !!x)
                                : [];
                              if (metaTickers.length > 1) {
                                const visible = metaTickers.slice(0, 2);
                                const overflow = metaTickers.length - visible.length;
                                return (
                                  <>
                                    {visible.map((tk) => (
                                      <span
                                        key={tk}
                                        style={{
                                          fontSize: 9.5, fontWeight: 800, borderRadius: 6, padding: "2px 7px",
                                          background: "rgb(26,61,43)", color: "white",
                                          letterSpacing: "0.04em",
                                        }}
                                      >
                                        {tk.toUpperCase()}
                                      </span>
                                    ))}
                                    {overflow > 0 && (
                                      <span style={{
                                        fontSize: 9.5, fontWeight: 700, borderRadius: 6, padding: "2px 7px",
                                        background: "rgba(26,61,43,0.12)", color: "rgb(26,61,43)",
                                        letterSpacing: "0.04em",
                                      }}>
                                        +{overflow}
                                      </span>
                                    )}
                                  </>
                                );
                              }
                              return ticker ? (
                                <span
                                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                                  title={ticker}
                                  aria-label={ticker}
                                  data-testid={`activity-ticker-${ticker}`}
                                >
                                  {/* Real brand mark for single-ticker rows.
                                      Skipped on multi-ticker rows above (the
                                      "+N more" affordance carries that
                                      shape; multiple logos would crowd the
                                      dense Activity feed).

                                      The redundant green ticker pill that
                                      used to render beside this logo was
                                      removed 2026-05-18 — StockLogo already
                                      falls back to ticker text inside the
                                      circle when the brand image fails
                                      (stock-logo.tsx lines 23-44), so the
                                      chip duplicated the same information.
                                      The "Invested AAPL AAPL" double-display
                                      the user flagged was the chip beside
                                      the logo. Logo carries brand-when-known
                                      and ticker-when-unknown. The wrapper's
                                      title + aria-label preserve the ticker
                                      for hover/screen-readers.

                                      Logo size bumped 14 → 16 to compensate
                                      for the missing chip's row presence —
                                      stays compact, but the brand mark now
                                      reads at a glance instead of hiding
                                      next to the status pill. */}
                                  <StockLogo ticker={ticker} size={16} />
                                </span>
                              ) : null;
                            })()}
                            {childLabel && (
                              <span style={{
                                fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 6px",
                                background: "rgba(26,61,43,0.08)", color: "rgb(26,61,43)",
                              }}>
                                {childLabel}
                              </span>
                            )}
                            <span style={{ fontSize: 10.5, color: "rgb(175,164,156)" }}>{ownerViewingParentContrib ? "Contribution" : config.label}</span>
                            {dateShort && <span style={{ fontSize: 10.5, color: "rgb(175,164,156)" }}>· {dateShort}</span>}
                            {/* Gift-source chip: renders only when the
                                gift came via a specific occasion page.
                                Absence = main gift page (the implicit
                                default, ~80% of volume). Locked
                                2026-05-19 per the gift-source-chip
                                sweep. */}
                            <GiftSourceChip eventName={(item as FeedActivity).eventName} />
                          </div>
                        </div>
                      </button>

                      {/* Inline Approve / Decline for kid_stock_suggestion
                          rows — always visible directly under the row,
                          NOT buried behind expand. Lets the parent triage
                          the kid's pick in one tap from the History feed
                          without forcing a tap-to-expand-then-tap-to-act
                          two-step. When already reviewed, shows the
                          resolved pill instead. Hidden when there's no
                          suggestionId (older rows that pre-date the
                          metadata enrichment fall back to the expanded
                          view's controls). */}
                      {isKidSuggestionCollapsed && collapsedFundIdForActivity && collapsedSuggestionId && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 0 12px 48px",
                            borderBottom: !isLast || isExpanded ? "1px solid rgba(26,23,16,0.06)" : "none",
                          }}
                        >
                          {collapsedSuggestionStatus ? (
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              padding: "5px 10px", borderRadius: 999,
                              background: collapsedSuggestionStatus === "approved" ? "rgb(224,237,227)" : "rgb(243,240,236)",
                              color: collapsedSuggestionStatus === "approved" ? "rgb(43,88,64)" : "rgb(100,90,80)",
                            }}>
                              {collapsedSuggestionStatus === "approved" ? "✓ Approved" : "✗ Declined"}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={collapsedSuggestionLoading}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void reviewSuggestion(collapsedFundIdForActivity, collapsedSuggestionId, "approved");
                                }}
                                data-testid={`button-approve-suggestion-inline-${rowId}`}
                                style={{
                                  fontSize: 11.5, fontWeight: 700,
                                  padding: "6px 14px", borderRadius: 999,
                                  background: "hsl(143,47%,32%)",
                                  color: "white", border: "none",
                                  cursor: collapsedSuggestionLoading ? "wait" : "pointer",
                                  opacity: collapsedSuggestionLoading ? 0.6 : 1,
                                  fontFamily: "inherit",
                                }}
                              >
                                {collapsedSuggestionLoading ? "Sending…" : "Approve"}
                              </button>
                              <button
                                type="button"
                                disabled={collapsedSuggestionLoading}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void reviewSuggestion(collapsedFundIdForActivity, collapsedSuggestionId, "declined");
                                }}
                                data-testid={`button-decline-suggestion-inline-${rowId}`}
                                style={{
                                  fontSize: 11.5, fontWeight: 700,
                                  padding: "6px 14px", borderRadius: 999,
                                  background: "white",
                                  color: "rgb(80,72,64)",
                                  border: "1px solid rgba(26,23,16,0.18)",
                                  cursor: collapsedSuggestionLoading ? "wait" : "pointer",
                                  opacity: collapsedSuggestionLoading ? 0.6 : 1,
                                  fontFamily: "inherit",
                                }}
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Expanded detail — type-specific richness instead of
                          repeating the collapsed row's description. The
                          collapsed row IS the at-a-glance summary; the
                          expansion has to earn the tap by showing material
                          NOT visible above (multi-ticker breakdown, sender
                          email, reason, schedule diff) plus deep-link
                          shortcuts to the relevant page (Memory Book, etc.). */}
                      <AnimatePresence>
                        {isExpanded && (() => {
                          const normalizedType = normalizeActivityType(item.type);
                          const tickers = Array.isArray((meta as any).tickers) ? ((meta as any).tickers as unknown[]).filter((t): t is string => typeof t === "string" && !!t) : [];
                          const hasMultipleTickers = tickers.length > 1;
                          const senderEmail = typeof (meta as any).senderEmail === "string" ? (meta as any).senderEmail : null;
                          const giftId = typeof (meta as any).giftId === "string" ? (meta as any).giftId : null;
                          const fundIdForActivity = (item as any).fundId as string | undefined;
                          const reasonRaw = typeof (meta as any).reason === "string" ? (meta as any).reason : null;
                          const reasonHuman = reasonRaw === "pick_failed"
                            ? "The picked stock couldn't be filled, so the gift was held as cash. You can invest it from the dashboard."
                            : reasonRaw === "empty_basket"
                              ? "No allocation was set, so the gift was held as cash. Invest it from the dashboard whenever you're ready."
                              : null;
                          // Recognizer for "schedule change" rows. The
                          // server now writes "Recurring investment
                          // started/updated/cancelled" titles per the
                          // locked-copy rule. The old "Auto-invest *"
                          // titles stay listed here for backward compat
                          // with rows already in the DB; remove them
                          // once the data is fully backfilled.
                          const isScheduleChange = [
                            "Recurring investment started",
                            "Recurring investment updated",
                            "Recurring investment cancelled",
                            "Recurring investment turned on",
                            "Recurring investment turned off",
                            "Recurring investment resumed",
                            "Auto-invest started",   // legacy — pre-rename rows
                            "Auto-invest updated",   // legacy
                            "Auto-invest cancelled", // legacy
                          ].includes(item.title || "");
                          const scheduleAmount = typeof (meta as any).amount === "string" || typeof (meta as any).amount === "number" ? Number((meta as any).amount) : null;
                          const scheduleFreq = typeof (meta as any).frequency === "string" ? (meta as any).frequency : null;
                          const scheduleTicker = typeof (meta as any).selectedTicker === "string" ? (meta as any).selectedTicker : null;
                          const scheduleExec = typeof (meta as any).executionModel === "string" ? (meta as any).executionModel : null;
                          const isMemoryEntry = normalizedType.startsWith("memory_");
                          const isGiftReceived = normalizedType === "gift_received" || normalizedType === "gift_received_cash" || normalizedType === "first_gift_received" || normalizedType === "parent_contribution";
                          const isInvest = normalizedType === "gift_invested" || normalizedType === "auto_invest" || normalizedType === "cash_invested";
                          // Kid stock suggestions get inline Approve/Decline
                          // controls in the expanded view (instead of forcing
                          // the parent to navigate to the kid-view manager).
                          const isKidSuggestion = normalizedType === "kid_stock_suggestion";
                          const suggestionId = typeof (meta as any).suggestionId === "string" ? (meta as any).suggestionId : null;
                          const suggestionTicker = typeof (meta as any).ticker === "string" ? (meta as any).ticker.toUpperCase() : null;
                          const suggestionReviewedStatus = isKidSuggestion && suggestionId ? reviewedSuggestionIds.get(suggestionId) ?? null : null;
                          const suggestionIsLoading = reviewingSuggestionId === suggestionId;
                          // Reconcile metadata — payment method, descriptor,
                          // receipt URL. Server stamps these on parent-paid
                          // rows (parent_contribution, subscription_renewal,
                          // refund) so the History row can answer "which bank
                          // line was this." Older rows that pre-date the
                          // enrichment leave fields null; the section
                          // collapses gracefully when nothing is present.
                          const reconcileBrand = typeof (meta as any).paymentMethodBrand === "string" ? (meta as any).paymentMethodBrand : null;
                          const reconcileLast4 = typeof (meta as any).paymentMethodLast4 === "string" ? (meta as any).paymentMethodLast4 : null;
                          const reconcileDescriptor = typeof (meta as any).descriptor === "string" ? (meta as any).descriptor : null;
                          const reconcileReceiptUrl = typeof (meta as any).stripeReceiptUrl === "string" ? (meta as any).stripeReceiptUrl : null;
                          const nextRetryRaw = (meta as any).nextRetryDate;
                          const nextRetryDate = typeof nextRetryRaw === "string" ? new Date(nextRetryRaw) : null;
                          const hasReconcile = !!(reconcileLast4 || reconcileDescriptor || reconcileReceiptUrl);
                          const isParentPaidType =
                            normalizedType === "parent_contribution" ||
                            normalizedType === "parent_contribution_failed" ||
                            normalizedType === "subscription_renewal" ||
                            normalizedType === "subscription_started" ||
                            normalizedType === "starter_plan_activated" ||
                            normalizedType === "family_plan_activated" ||
                            normalizedType === "payment_failed" ||
                            normalizedType === "refund";

                          // Action chips. Each links to where the parent
                          // would actually go from this row — Memory Book for
                          // gift / memory rows, Dashboard for holdings/schedule
                          // rows. Reuses the deep-link pattern (?gift= for
                          // specific gifts, hash anchors for sections).
                          type ActionChip = { label: string; href: string; testId: string; external?: boolean };
                          const chips: ActionChip[] = [];
                          if (fundIdForActivity) {
                            if (isGiftReceived && giftId) {
                              chips.push({
                                label: "View in Memory Book →",
                                href: `/memory/${fundIdForActivity}?gift=${encodeURIComponent(giftId)}`,
                                testId: `chip-memory-${rowId}`,
                              });
                            } else if (isMemoryEntry) {
                              chips.push({
                                label: "Open Memory Book →",
                                href: `/memory/${fundIdForActivity}`,
                                testId: `chip-memory-${rowId}`,
                              });
                            }
                            if (isInvest) {
                              // Singular "View holding" only when this row
                              // really points to ONE specific holding —
                              // either a single named ticker or a single
                              // entry in the tickers array. Multi-position
                              // rows (recurring auto-invest spread across
                              // 4 ETFs, etc.) and ticker-less rows both
                              // get the plural "View holdings." Previously
                              // 4-ticker rows rendered "View holding" which
                              // read as "view the one holding" — wrong
                              // count visible to the parent.
                              const positionCount = tickers.length > 0
                                ? tickers.length
                                : (ticker ? 1 : 0);
                              const isPlural = positionCount !== 1;
                              chips.push({
                                // Deep-link to the holdings section so the
                                // parent lands directly on what the chip
                                // promises, instead of the fund hero where
                                // they'd have to scroll past the hero +
                                // "Quick links" + "Who Loves Emma" to find
                                // the holdings. Dashboard.tsx:2062 already
                                // handles ?section=holdings → smooth
                                // scrollIntoView on mount.
                                label: isPlural ? "View holdings →" : "View holding →",
                                href: `/dashboard?fund=${fundIdForActivity}&section=holdings`,
                                testId: `chip-holdings-${rowId}`,
                              });
                            }
                            if (isScheduleChange) {
                              // Was routing to `/dashboard?fund=...` — Dashboard's
                              // root, where the parent had to scroll to "Your part
                              // of Emma's story" to find their schedules. Activity
                              // > Scheduled is the purpose-built management surface
                              // (it lists every schedule with the Active/Paused
                              // pill, hasRecentFailure indicator, History icon →
                              // detail modal, and inline pause/edit/cancel
                              // controls). Right destination for "Manage schedules."
                              chips.push({
                                label: "Manage schedules →",
                                href: `/activity?tab=scheduled`,
                                testId: `chip-schedules-${rowId}`,
                              });
                            }
                          }
                          // View receipt — Stripe-hosted receipt URL when we
                          // captured one in the webhook. Opens in a new tab
                          // so the parent never loses Activity context. This
                          // is the "source of truth proof" link Acorns surfaces
                          // and we previously didn't have anywhere.
                          if (reconcileReceiptUrl) {
                            chips.push({
                              label: "View receipt ↗",
                              href: reconcileReceiptUrl,
                              testId: `chip-receipt-${rowId}`,
                              external: true,
                            });
                          }
                          // Report issue — pre-fills a support email with
                          // the row's identifying info so the parent never
                          // has to explain "which transaction" or hunt for
                          // an ID. Only surfaced on money-flow rows where a
                          // dispute could realistically apply.
                          const reportableTypes = [
                            "gift_received", "gift_invested", "gift_received_cash",
                            "parent_contribution", "parent_contribution_failed",
                            "auto_invest", "cash_invested", "withdrawal",
                            "subscription_renewal", "subscription_started", "payment_failed",
                            "starter_plan_activated", "family_plan_activated",
                            "refund",
                          ];
                          if (reportableTypes.includes(normalizedType)) {
                            const dateLabel = createdAt ? createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "(date unavailable)";
                            const amtLabel = amtNum != null ? `$${amtNum.toFixed(2)}` : "(amount unavailable)";
                            const subject = `Issue with transaction · ${rewriteLegacyAutoInvestTitle(item.title) || normalizedType} · ${amtLabel}`;
                            const body = [
                              `Hi Kiddo team,`,
                              ``,
                              `I have a question about this transaction:`,
                              ``,
                              `Type: ${rewriteLegacyAutoInvestTitle(item.title) || normalizedType}`,
                              `Amount: ${amtLabel}`,
                              `Date: ${dateLabel}`,
                              `Activity ID: ${item.id || "(unknown)"}`,
                              fundIdForActivity ? `Fund ID: ${fundIdForActivity}` : "",
                              `What happened: `,
                              ``,
                            ].filter(Boolean).join("\n");
                            chips.push({
                              label: "Report an issue →",
                              href: `mailto:support@kiddofund.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
                              testId: `chip-report-${rowId}`,
                              external: true,
                            });
                          }
                          return (
                            <motion.div
                              // Row-expansion: tap a collapsed activity row,
                              // the detail panel slides down from height 0.
                              // Gated on prefersReducedMotion so users with
                              // vestibular sensitivity see an instant reveal
                              // instead of the slide. The exit animation
                              // similarly snaps when reduced-motion is on.
                              initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={prefersReducedMotion ? { height: 0, opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                              transition={prefersReducedMotion ? { duration: 0 } : MOTION.modal}
                              style={{ overflow: "hidden" }}
                            >
                              <div
                                style={{
                                  paddingLeft: 48, paddingRight: 4, paddingBottom: 14, paddingTop: 8,
                                  borderBottom: isLast ? "none" : "1px solid rgba(26,23,16,0.06)",
                                  display: "flex", flexDirection: "column", gap: 10,
                                }}
                                data-testid={`detail-view-${rowId}`}
                              >
                                {/* Multi-position breakdown — only when there are
                                    actually multiple tickers (single-ticker info
                                    is in the collapsed row's pill). */}
                                {hasMultipleTickers && (
                                  <div>
                                    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "rgb(140,130,122)", marginBottom: 6 }}>
                                      Spread across
                                    </p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                      {/* In the EXPANDED breakdown view, the
                                          row is no longer space-constrained,
                                          so each ticker gets a leading logo
                                          alongside its pill — the parent has
                                          already chosen to dig in, so the
                                          extra brand-recognition density is
                                          load-bearing rather than crowding.
                                          (The collapsed multi-ticker case
                                          still shows pills + "+N more"
                                          without logos to keep the dense
                                          feed scannable.) */}
                                      {tickers.map((t) => (
                                        <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                          <StockLogo ticker={t} size={16} fallbackText={false} />
                                          <span
                                            style={{
                                              fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "3px 8px",
                                              background: "rgb(26,61,43)", color: "white", letterSpacing: "0.05em",
                                            }}
                                          >
                                            {t}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Mutation clarity — locked rule: parent
                                    surfaces always show before → after on
                                    portfolio mutations. fund_strategy_changed
                                    and custom_allocations_changed carry the
                                    diff in metadata; render it as a two-line
                                    arrow form so the parent can SEE the
                                    change without parsing prose. Per the
                                    strategy emoji map (Conservative
                                    🛡️ / Balanced ⚖️ / Growth 📈 / Custom 🎯),
                                    centralized in @/lib/strategy.
                                    Never on gifter or Memory Book surfaces —
                                    those are different philosophies. */}
                                {(normalizedType === "fund_strategy_changed" || normalizedType === "custom_allocations_changed") && (() => {
                                  const STRATEGY_LABELS: Record<string, { label: string; emoji: string }> = {
                                    conservative: { label: STRATEGY_SHORT.conservative, emoji: STRATEGY_EMOJI.conservative },
                                    balanced:     { label: STRATEGY_SHORT.balanced,     emoji: STRATEGY_EMOJI.balanced },
                                    growth:       { label: STRATEGY_SHORT.growth,       emoji: STRATEGY_EMOJI.growth },
                                    custom:       { label: STRATEGY_SHORT.custom,       emoji: STRATEGY_EMOJI.custom },
                                  };
                                  if (normalizedType === "fund_strategy_changed") {
                                    // Accept both metadata shapes: the newer
                                    // previousStrategy/newStrategy AND the
                                    // from/to pair the strategy-evolution rows
                                    // are written with — without the fallback,
                                    // the pills rendered a literal "• Previous
                                    // → • New" instead of "Growth → Balanced".
                                    const prevKey = String((meta as any).previousStrategy || (meta as any).from || "").toLowerCase();
                                    const nextKey = String((meta as any).newStrategy || (meta as any).to || "").toLowerCase();
                                    const prev = STRATEGY_LABELS[prevKey] || { label: prevKey || "Previous", emoji: "•" };
                                    const next = STRATEGY_LABELS[nextKey] || { label: nextKey || "New", emoji: "•" };
                                    return (
                                      <div style={{
                                        background: "rgba(126,68,180,0.05)",
                                        border: "1px solid rgba(126,68,180,0.18)",
                                        borderRadius: 10,
                                        padding: "12px 14px",
                                      }} data-testid={`mutation-strategy-${rowId}`}>
                                        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "rgb(126,68,180)", marginBottom: 8 }}>
                                          Strategy change
                                        </p>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "rgb(26,23,16)", flexWrap: "wrap" }}>
                                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(26,23,16,0.04)", border: "1px solid rgba(26,23,16,0.10)", color: "rgb(100,92,86)" }}>
                                            <span aria-hidden>{prev.emoji}</span>
                                            <span style={{ fontWeight: 600 }}>{prev.label}</span>
                                          </span>
                                          <span style={{ color: "rgba(26,23,16,0.42)", fontSize: 16 }} aria-hidden>→</span>
                                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(126,68,180,0.10)", border: "1px solid rgba(126,68,180,0.26)", color: "rgb(60,30,100)" }}>
                                            <span aria-hidden>{next.emoji}</span>
                                            <span style={{ fontWeight: 700 }}>{next.label}</span>
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  // custom_allocations_changed — render the
                                  // ticker-by-ticker diff for any allocation
                                  // that moved. Shows added (new line), removed
                                  // (struck-through), and changed (before →
                                  // after pct). Parent can see exactly what
                                  // moved instead of re-deriving it from "Custom
                                  // mix updated · Allocations adjusted."
                                  const prevAlloc = ((meta as any).previousAllocations || {}) as Record<string, number>;
                                  const nextAlloc = ((meta as any).newAllocations || {}) as Record<string, number>;
                                  const allTickers = Array.from(new Set([...Object.keys(prevAlloc), ...Object.keys(nextAlloc)])).sort();
                                  const fmtPct = (n: number) => `${(Number.isFinite(n) ? Math.round(n * 100) / 100 : 0).toString()}%`;
                                  const diffs = allTickers.map((t) => {
                                    const before = Number(prevAlloc[t] ?? 0);
                                    const after = Number(nextAlloc[t] ?? 0);
                                    return { ticker: t, before, after, kind: before === 0 ? "added" : after === 0 ? "removed" : before === after ? "same" : "changed" };
                                  }).filter((d) => d.kind !== "same");
                                  if (diffs.length === 0) return null;
                                  return (
                                    <div style={{
                                      background: "rgba(126,68,180,0.05)",
                                      border: "1px solid rgba(126,68,180,0.18)",
                                      borderRadius: 10,
                                      padding: "12px 14px",
                                    }} data-testid={`mutation-allocations-${rowId}`}>
                                      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "rgb(126,68,180)", marginBottom: 8 }}>
                                        Custom mix · what moved
                                      </p>
                                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {diffs.map((d) => (
                                          <div key={d.ticker} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "rgb(26,23,16)" }}>
                                            <span style={{ minWidth: 64, fontWeight: 700, letterSpacing: "0.04em" }}>{d.ticker}</span>
                                            {d.kind === "added" && (
                                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgb(26,67,50)", fontWeight: 600 }}>
                                                <span aria-hidden>+</span> {fmtPct(d.after)}
                                              </span>
                                            )}
                                            {d.kind === "removed" && (
                                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgb(190,30,30)", fontWeight: 600 }}>
                                                <span style={{ textDecoration: "line-through", color: "rgba(26,23,16,0.45)" }}>{fmtPct(d.before)}</span>
                                                <span aria-hidden>→</span>
                                                <span>removed</span>
                                              </span>
                                            )}
                                            {d.kind === "changed" && (
                                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                                                <span style={{ color: "rgba(26,23,16,0.55)" }}>{fmtPct(d.before)}</span>
                                                <span aria-hidden style={{ color: "rgba(26,23,16,0.42)" }}>→</span>
                                                <span style={{ color: d.after > d.before ? "rgb(26,67,50)" : "rgb(190,30,30)" }}>{fmtPct(d.after)}</span>
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Sell + withdrawal mutation clarity — these
                                    rows already carry their before-state in
                                    the title (e.g. "GOOGL moved to cash") and
                                    their after-state in the description ("0.5
                                    shares moved to cash for $172.50"). The
                                    parent's question on tap is "exactly how
                                    much, where to, when does it settle." A
                                    structured panel pulls the salient numbers
                                    out of prose into a glanceable form. */}
                                {(normalizedType === "sell" || normalizedType === "withdrawal") && (() => {
                                  const sellTicker = ticker || (typeof (meta as any).ticker === "string" ? (meta as any).ticker.toUpperCase() : null);
                                  const sellShares = typeof (meta as any).shares === "string" || typeof (meta as any).shares === "number"
                                    ? Number((meta as any).shares) : null;
                                  const isSell = normalizedType === "sell";
                                  const bankName = typeof (meta as any).bankName === "string" ? (meta as any).bankName : null;
                                  const bankLast4 = typeof (meta as any).bankLast4 === "string" ? (meta as any).bankLast4 : null;
                                  const withdrawalDelivered = String((meta as any).status || "") === "completed";
                                  const beforeLabel = isSell
                                    ? (sellTicker
                                        ? (sellShares != null && Number.isFinite(sellShares) ? `${sellShares.toFixed(4).replace(/\.?0+$/, "")} ${sellTicker}` : sellTicker)
                                        : "Holding")
                                    : "Fund cash";
                                  const afterLabel = isSell
                                    ? cashAfterLabel(item.createdAt)
                                    : bankName && bankLast4
                                      ? `${bankName} ···${bankLast4}${withdrawalDelivered ? "" : " (queued)"}`
                                      : withdrawalDelivered
                                        ? "Bank transfer sent"
                                        : "Bank transfer queued";
                                  return (
                                    <div style={{
                                      background: "rgba(30,80,170,0.05)",
                                      border: "1px solid rgba(30,80,170,0.18)",
                                      borderRadius: 10,
                                      padding: "12px 14px",
                                    }} data-testid={`mutation-${normalizedType}-${rowId}`}>
                                      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "rgb(30,80,170)", marginBottom: 8 }}>
                                        {isSell ? "What moved" : "Withdrawal"}
                                      </p>
                                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "rgb(26,23,16)", flexWrap: "wrap" }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(26,23,16,0.04)", border: "1px solid rgba(26,23,16,0.10)", color: "rgb(100,92,86)" }}>
                                          <span style={{ fontWeight: 600 }}>{beforeLabel}</span>
                                        </span>
                                        <span style={{ color: "rgba(26,23,16,0.42)", fontSize: 16 }} aria-hidden>→</span>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(30,80,170,0.10)", border: "1px solid rgba(30,80,170,0.26)", color: "rgb(20,50,130)" }}>
                                          <span style={{ fontWeight: 700 }}>{afterLabel}</span>
                                          {amtNum != null && Number.isFinite(amtNum) && (
                                            <span style={{ color: "rgba(20,50,130,0.78)", fontWeight: 600 }}>· {formatCurrency(amtNum)}</span>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Schedule details — for auto-invest start /
                                    update / cancel rows. Shows the actual
                                    amount + frequency + destination so the
                                    parent doesn't have to re-parse the title. */}
                                {isScheduleChange && (scheduleAmount != null || scheduleFreq || scheduleTicker || scheduleExec) && (
                                  <div style={{
                                    background: "rgba(26,67,50,0.04)",
                                    border: "1px solid rgba(26,67,50,0.10)",
                                    borderRadius: 10,
                                    padding: "10px 12px",
                                    display: "grid",
                                    gridTemplateColumns: "auto 1fr",
                                    gap: "6px 12px",
                                  }}>
                                    {scheduleAmount != null && Number.isFinite(scheduleAmount) && (
                                      <>
                                        <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>Amount</p>
                                        <p style={{ fontSize: 12, color: "rgb(26,23,16)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(scheduleAmount)}</p>
                                      </>
                                    )}
                                    {scheduleFreq && (
                                      <>
                                        <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>Frequency</p>
                                        <p style={{ fontSize: 12, color: "rgb(26,23,16)", fontWeight: 600, textTransform: "capitalize" as const }}>{scheduleFreq}</p>
                                      </>
                                    )}
                                    {(scheduleTicker || scheduleExec) && (
                                      <>
                                        <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>Destination</p>
                                        <p style={{ fontSize: 12, color: "rgb(26,23,16)", fontWeight: 600 }}>
                                          {scheduleTicker || (scheduleExec === "family" ? "Managed mix" : "Auto-allocated")}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* Cash-held reason — for gift_received_cash.
                                    Tells the parent WHY the gift went to cash
                                    instead of investing, plus the next step. */}
                                {reasonHuman && (
                                  <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.70)", lineHeight: 1.55, padding: "8px 10px", background: "hsl(43,55%,95%)", borderRadius: 8, border: "1px solid hsl(43,40%,86%)" }}>
                                    {reasonHuman}
                                  </p>
                                )}

                                {/* Kid stock suggestion — inline approve/decline.
                                    Three states:
                                    1. Pending → show two buttons (Approve / Decline)
                                    2. In flight → both buttons disabled, label "Sending..."
                                    3. Reviewed → persistent pill ("✓ Approved Apr 28" /
                                       "✗ Declined Apr 28") so the row reads as resolved.
                                    The original suggestion activity persists either way
                                    (audit trail); a NEW activity row appears below for
                                    the parent's review action ("You approved AZO").
                                    Kid sees the new status the next time their view
                                    polls the kid-view record. */}
                                {/* (Removed: the expanded-view kid suggestion
                                    box. With Approve/Decline now inline in
                                    the row's collapsed area + ticker
                                    already shown in the meta-row pill +
                                    reason already in the description, this
                                    box added nothing the row didn't already
                                    have. Deleting it eliminated a third
                                    repetition of the kid's "because" reason
                                    and made the expanded view earn its
                                    tap with full timestamp + action chips
                                    only.) */}

                                {/* Sender details — for gifts from external
                                    gifters (not parent contributions). The
                                    email lets the parent reach out personally
                                    if they want, beyond the in-app thank-you. */}
                                {senderEmail && !((meta as any).isParentContribution) && (
                                  <p style={{ fontSize: 12, color: "rgba(26,23,16,0.55)" }}>
                                    From <a href={`mailto:${senderEmail}`} style={{ color: "hsl(143,47%,28%)", textDecoration: "none", fontWeight: 600 }}>{senderEmail}</a>
                                  </p>
                                )}

                                {/* Reconcile mini-card — payment method,
                                    statement descriptor, and Stripe receipt
                                    detail for parent-paid rows. The bank-
                                    statement reconciliation surface that
                                    closed Gap 4 of the Activity audit:
                                    parents seeing "KIDDO $3.99" on Chase
                                    couldn't match it to anything inside
                                    the app. Renders only when there's
                                    something material to show + only on
                                    parent-paid row types. */}
                                {isParentPaidType && hasReconcile && (
                                  <div
                                    style={{
                                      background: "rgba(15,82,42,0.04)",
                                      border: "1px solid rgba(15,82,42,0.10)",
                                      borderRadius: 10,
                                      padding: "10px 12px",
                                      display: "grid",
                                      gridTemplateColumns: "auto 1fr",
                                      gap: "6px 12px",
                                    }}
                                    data-testid={`reconcile-${rowId}`}
                                  >
                                    {reconcileLast4 && (
                                      <>
                                        <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>Charged to</p>
                                        <p style={{ fontSize: 12, color: "rgb(26,23,16)", fontWeight: 600 }}>
                                          {reconcileBrand ? reconcileBrand.charAt(0).toUpperCase() + reconcileBrand.slice(1) : "Card"} ····{reconcileLast4}
                                        </p>
                                      </>
                                    )}
                                    {reconcileDescriptor && (
                                      <>
                                        <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>On your statement</p>
                                        <p style={{ fontSize: 12, color: "rgb(26,23,16)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                          {reconcileDescriptor}
                                        </p>
                                      </>
                                    )}
                                    {nextRetryDate && Number.isFinite(nextRetryDate.getTime()) && (
                                      <>
                                        <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>Next attempt</p>
                                        <p style={{ fontSize: 12, color: "rgb(26,23,16)", fontWeight: 600 }}>
                                          {nextRetryDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* Gift message — larger, italic, with proper
                                    quote framing. Shown in addition to the
                                    inline preview above (which truncates). */}
                                {giftMessage && (
                                  <p style={{ fontSize: 13.5, color: "rgba(26,23,16,0.78)", lineHeight: 1.55, fontStyle: "italic", paddingLeft: 10, borderLeft: "2px solid rgba(26,67,50,0.20)" }}>
                                    &ldquo;{giftMessage}&rdquo;
                                  </p>
                                )}

                                {/* (Removed: the fallback description paragraph
                                    that just re-printed `item.description`.
                                    The collapsed row above already shows the
                                    description (truncated with ellipsis when
                                    long); printing it again verbatim made
                                    every expanded view feel like a duplicate.
                                    If the description is genuinely long and
                                    got cut off, the next paragraph handles
                                    that case explicitly with full-text
                                    rendering — no repetition for short
                                    descriptions that already fit the row.) */}
                                {/* Long-description full text — only when the
                                    collapsed row's `whiteSpace: nowrap`
                                    actually truncated the description (>120
                                    chars heuristic) AND nothing richer above
                                    already covered it. Skips kid suggestions
                                    (their box renders the reason styled). */}
                                {!giftMessage && !hasMultipleTickers && !isScheduleChange && !reasonHuman && !isKidSuggestion && item.description && item.description.length > 120 && (
                                  <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.70)", lineHeight: 1.55, whiteSpace: "pre-wrap" as const }}>
                                    {rewriteLegacyDescription(item.description)}
                                  </p>
                                )}

                                {/* Date + action chips row. Date stays full-form
                                    here because the collapsed row only shows
                                    month/day. The clock time was dropped: it's
                                    noise on a financial ledger (the date is the
                                    unit), and on backfilled history it printed a
                                    fake-looking fixed "at 8:00 PM". */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" as const }}>
                                  <p style={{ fontSize: 11, color: "rgb(160,150,140)" }}>
                                    {createdAt
                                      ? createdAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                                      : "Date unavailable"}
                                  </p>
                                  {chips.length > 0 && (
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                                      {chips.map((chip) => {
                                        const sharedStyle = {
                                          fontSize: 11, fontWeight: 700, color: "hsl(143,47%,22%)",
                                          background: "rgba(26,67,50,0.08)",
                                          border: "1px solid rgba(26,67,50,0.18)",
                                          borderRadius: 999, padding: "5px 11px",
                                          cursor: "pointer", fontFamily: "inherit",
                                          transition: "background 0.12s",
                                          textDecoration: "none" as const,
                                          display: "inline-flex" as const, alignItems: "center" as const,
                                        };
                                        if (chip.external) {
                                          // Stripe receipt URL or mailto link — open
                                          // in a new tab/native handler instead of
                                          // routing through the SPA navigator.
                                          const isMailto = chip.href.startsWith("mailto:");
                                          return (
                                            <a
                                              key={chip.testId}
                                              href={chip.href}
                                              target={isMailto ? undefined : "_blank"}
                                              rel={isMailto ? undefined : "noopener noreferrer"}
                                              onClick={(e) => { e.stopPropagation(); haptic("selection"); }}
                                              data-testid={chip.testId}
                                              style={sharedStyle}
                                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(26,67,50,0.14)")}
                                              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(26,67,50,0.08)")}
                                            >
                                              {chip.label}
                                            </a>
                                          );
                                        }
                                        return (
                                          <button
                                            key={chip.testId}
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); haptic("selection"); navigate(chip.href); }}
                                            data-testid={chip.testId}
                                            style={sharedStyle}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(26,67,50,0.14)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(26,67,50,0.08)")}
                                          >
                                            {chip.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })()}
                      </AnimatePresence>
                    </div>
                      );
                    })()}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </EnlighteningReveal>
        ))}
          </motion.div>
        )}
        {/* ============================ END HISTORY TAB ============================ */}

        {/* ============================ PENDING TAB ============================ */}
        {tab === "pending" && (
          <motion.div
            key="activity-tab-pending"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            data-testid="pending-content"
          >
            {pendingTotalCount === 0 ? (
              <EnlighteningReveal>
                <div className="kiddo-card" style={{
                  padding: "48px 24px", textAlign: "center",
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 9999,
                    background: "rgb(237,244,238)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px",
                  }}>
                    <Check size={22} style={{ color: "rgb(26,67,50)" }} />
                  </div>
                  <p className="font-heading" style={{ fontSize: 18, fontWeight: 700, color: "rgb(26,23,16)", marginBottom: 6 }}>
                    Nothing in transit right now.
                  </p>
                  <p style={{ fontSize: 13.5, color: "rgb(140,130,122)", lineHeight: 1.6 }}>
                    All gifts and additions are settled and invested. ✅
                  </p>
                </div>
              </EnlighteningReveal>
            ) : (
              <>
                {/* In transit — gifts + processing items still moving */}
                {pendingFromFeed.length > 0 && (
                  <EnlighteningReveal>
                    <div style={{ marginBottom: 22 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgb(140,130,122)", marginBottom: 10 }}>
                        In transit
                      </p>
                      <div className="kiddo-card" style={{
                        padding: "0 18px",
                      }}>
                        {pendingFromFeed.map((item, i) => {
                          const config = getTypeConfig(item.type);
                          const createdAt = parseSafeDate(item.createdAt);
                          const amtNum = parseAmount(item.amount);
                          const isLast = i === pendingFromFeed.length - 1;
                          return (
                            <div
                              key={String(item.id || `${i}-${item.title}`)}
                              style={{
                                display: "flex", alignItems: "flex-start", gap: 12,
                                padding: "14px 0",
                                borderBottom: isLast ? "none" : "1px solid rgba(26,23,16,0.06)",
                              }}
                              data-testid={`pending-row-${item.id || i}`}
                            >
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: "rgb(232,242,255)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: "1px solid rgba(30,80,170,0.18)",
                              }}>
                                <Clock size={16} style={{ color: "rgb(30,80,170)" }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                                    {rewriteLegacyAutoInvestTitle(item.title) || "Settling"}
                                  </p>
                                  {amtNum != null && (
                                    <p className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: "rgb(26,23,16)" }}>
                                      {amtNum > 0 ? "+" : ""}{formatCurrency(amtNum)}
                                    </p>
                                  )}
                                </div>
                                {rewriteLegacyDescription(item.description) && (
                                  <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.55)", marginTop: 3, lineHeight: 1.45 }}>
                                    {rewriteLegacyDescription(item.description)}
                                  </p>
                                )}
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                                  <StatusPill status={item.status} type={item.type} />
                                  <span style={{ fontSize: 10.5, color: "rgb(175,164,156)" }}>
                                    {config.label}
                                    {createdAt ? ` · received ${createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </EnlighteningReveal>
                )}

                {/* Coming soon — contributions running within PENDING_UPCOMING_DAYS */}
                {upcomingContribs.length > 0 && (
                  <EnlighteningReveal>
                    <div style={{ marginBottom: 22 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgb(140,130,122)", marginBottom: 10 }}>
                        Coming soon (next {PENDING_UPCOMING_DAYS} days)
                      </p>
                      <div className="kiddo-card" style={{
                        padding: "0 18px",
                      }}>
                        {upcomingContribs.map((c: any, i: number) => {
                          const isLast = i === upcomingContribs.length - 1;
                          const next = c.nextRunDate ? new Date(c.nextRunDate) : null;
                          const amtNum = parseAmount(c.amount);
                          return (
                            <div
                              key={c.id}
                              style={{
                                display: "flex", alignItems: "flex-start", gap: 12,
                                padding: "14px 0",
                                borderBottom: isLast ? "none" : "1px solid rgba(26,23,16,0.06)",
                              }}
                              data-testid={`upcoming-row-${c.id}`}
                            >
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: "rgb(255,247,230)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: "1px solid rgba(184,121,26,0.2)",
                              }}>
                                <Calendar size={16} style={{ color: "rgb(184,121,26)" }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(26,23,16)" }}>
                                    Recurring investment runs {next ? next.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "soon"}
                                  </p>
                                  {amtNum != null && (
                                    <p className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: "rgb(26,23,16)" }}>
                                      {formatCurrency(amtNum)}
                                    </p>
                                  )}
                                </div>
                                <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.55)", marginTop: 3 }}>
                                  Into {ownerModeFundIds.has(String((c as any).fundId)) ? "your" : c.recipientFirstName ? `${capFirst(c.recipientFirstName)}'s` : "the"} fund · {c.frequency}
                                </p>
                                {/* Manage link added 2026-05-25 — user-flagged
                                    that pending 'Coming soon' rows had no
                                    action ('shouldnt i be able to adjust
                                    something in pending like cancel it'). The
                                    full management UI (pause, resume, cancel,
                                    top-up) lives on the Scheduled tab where
                                    pauseToggleMutation + cancelContribMutation
                                    are already wired. Routing here keeps
                                    Pending visually clean (it's a 'peek at
                                    what's coming' surface) while giving the
                                    user a one-tap path to act. ?tab=scheduled
                                    &highlight={id} triggers the existing
                                    scroll-to-highlight helper, so the user
                                    lands on Scheduled with this exact row
                                    pre-scrolled + outlined. */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    haptic("selection");
                                    navigate(`/activity?tab=scheduled&highlight=${encodeURIComponent(String(c.id))}`);
                                  }}
                                  className="mt-2 text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline underline-offset-2"
                                  data-testid={`upcoming-manage-${c.id}`}
                                >
                                  Pause or cancel →
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </EnlighteningReveal>
                )}
              </>
            )}
          </motion.div>
        )}
        {/* ============================ END PENDING TAB ============================ */}

        {/* ============================ SCHEDULED TAB ============================ */}
        {tab === "scheduled" && (
          <motion.div
            key="activity-tab-scheduled"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            data-testid="scheduled-content"
          >
            {scheduledTotalCount === 0 ? (
              <EnlighteningReveal>
                <div className="kiddo-card" style={{
                  padding: "48px 24px", textAlign: "center",
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 9999,
                    background: "rgb(255,247,230)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px",
                  }}>
                    <Repeat size={22} style={{ color: "rgb(184,121,26)" }} />
                  </div>
                  <p className="font-heading" style={{ fontSize: 18, fontWeight: 700, color: "rgb(26,23,16)", marginBottom: 6 }}>
                    No recurring investments yet.
                  </p>
                  <p style={{ fontSize: 13.5, color: "rgb(140,130,122)", lineHeight: 1.6, marginBottom: 18 }}>
                    Set up a recurring investment and the fund grows every month. Automatically.
                  </p>
                  <Button
                    // Solid evergreen primary — brand gold is reserved for
                    // the canonical Share CTA. The recurring-investment CTA
                    // is a parent-action, not a share, and shouldn't visually
                    // compete with the AppHeader Share button.
                    className="rounded-full"
                    onClick={() => { haptic("medium"); navigate("/dashboard"); }}
                    data-testid="button-scheduled-empty-cta"
                  >
                    Set up recurring investment →
                  </Button>
                </div>
              </EnlighteningReveal>
            ) : (
              <>
                {/* Recurring investments */}
                {scheduledContribs.length > 0 && (
                  <EnlighteningReveal>
                    <div style={{ marginBottom: 22 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgb(140,130,122)", marginBottom: 10 }}>
                        Recurring investments
                      </p>
                      <div className="kiddo-card" style={{
                        padding: "0 18px",
                      }}>
                        {scheduledContribs.map((c: any, i: number) => {
                          const isLast = i === scheduledContribs.length - 1;
                          const isPaused = c.status === "paused";
                          const next = c.nextRunDate ? new Date(c.nextRunDate) : null;
                          const last = c.lastRunDate ? new Date(c.lastRunDate) : null;
                          const amtNum = parseAmount(c.amount);
                          const totalNum = parseAmount(c.totalContributed);
                          const ticker = c.executionModel === "pick" && typeof c.selectedTicker === "string" ? c.selectedTicker.toUpperCase() : null;
                          const strategyLabel = ticker
                            ? `into ${ticker}`
                            : c.executionModel === "family"
                              ? "into family mix"
                              : // "managed mix" → "diversified mix" 2026-05-20.
                                // Cross-surface unification with Pricing /
                                // Dashboard / GiftCheckout / FundsOverview
                                // (which all use "diversified mix"). "Managed"
                                // carried an active-management connotation
                                // (active mutual-fund-style framing) that
                                // conflicts with the locked passive-ETF
                                // discipline. "Diversified" is factual and
                                // matches the canonical product language.
                                // "family mix" branch above stays — that's
                                // a Family-plan-specific distinction (shared
                                // strategy across kids) that carries real
                                // load-bearing information for Family parents.
                                "into the full mix";
                          const isExpanded = expandedScheduledId === String(c.id);
                          const note = typeof c.note === "string" && c.note.trim() ? c.note.trim() : null;
                          const idStr = String(c.id);
                          // Recurring that ended at the age-of-majority handoff
                          // (worker stamps pause_reason 'majority_handoff'). It's
                          // the former parent's plan — not resumable/editable by
                          // the new owner (those endpoints 403 on a record they
                          // don't own), so render it as read-only history rather
                          // than a live, actionable schedule.
                          // Read-only for the post-handoff owner. On a handed-off
                          // fund the recurring schedule was the custodian parent's
                          // (on the parent's card) — the owner can't resume/edit/
                          // cancel it (every mutation 403s), so treat it as ended
                          // history regardless of the stored pause_reason. Keys on
                          // owner-mode, not just pause_reason === 'majority_handoff',
                          // so stale/user-paused rows on an owned fund still render
                          // correctly.
                          const isOwnerHistorical = c.pauseReason === "majority_handoff" || activeFundIsOwned || ownerModeFundIds.has(String((c as any).fundId));
                          const isMutating =
                            (pauseToggleMutation.isPending && pauseToggleMutation.variables?.id === idStr) ||
                            (cancelScheduleMutation.isPending && cancelScheduleMutation.variables === idStr) ||
                            (contributeNowMutation.isPending && contributeNowMutation.variables === idStr);

                          return (
                            <div
                              key={c.id}
                              style={{
                                padding: "14px 8px",
                                margin: "0 -8px",
                                borderBottom: isLast ? "none" : "1px solid rgba(26,23,16,0.06)",
                                ...getDeepLinkHighlightStyle(highlightedId === String(c.id)),
                                opacity: isMutating ? 0.6 : 1,
                                transition: "opacity 0.15s",
                              }}
                              data-testid={`scheduled-contrib-${c.id}`}
                            >
                              {/* Collapsed summary row — tappable to expand.
                                  Implemented as a div + role="button" rather
                                  than a real <button> so the right-side
                                  History icon (a real <button>) can live as
                                  a child without violating the no-nested-
                                  buttons HTML rule. Keyboard accessibility
                                  preserved via tabIndex + onKeyDown. */}
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleScheduledExpand(idStr)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    toggleScheduledExpand(idStr);
                                  }
                                }}
                                aria-expanded={isExpanded}
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 12,
                                  padding: 0,
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <div style={{
                                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                  background: isPaused ? "rgb(254,243,199)" : "rgb(237,244,238)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  border: `1px solid ${isPaused ? "rgba(184,121,26,0.18)" : "rgba(26,67,50,0.15)"}`,
                                }}>
                                  <Repeat size={16} style={{ color: isPaused ? "rgb(184,121,26)" : "rgb(26,67,50)" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                                    <p style={{ fontSize: 13.5, fontWeight: 700, color: isPaused ? "rgb(140,130,122)" : "rgb(26,23,16)" }}>
                                      {amtNum != null ? `${formatCurrency(amtNum)} every ${c.frequency === "weekly" ? "week" : c.frequency === "yearly" ? "year" : c.frequency === "daily" ? "day" : "month"}` : `Recurring · ${c.frequency}`}
                                    </p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                                      {/* Failure indicator — shown when the
                                          recurring worker failed within the
                                          last 14 days (server-enriched via
                                          `hasRecentFailure`). Surfaces a
                                          silent-failure mode that was
                                          previously invisible to parents
                                          (Stripe declined → email
                                          reminder → schedule kept "Active"
                                          status with no UI clue). */}
                                      {c.hasRecentFailure && !isPaused && (
                                        <span
                                          style={{
                                            fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 7px",
                                            background: "rgb(254,228,228)",
                                            color: "rgb(170,38,38)",
                                            display: "inline-flex", alignItems: "center", gap: 3,
                                          }}
                                          title="Last automatic charge failed; an email reminder went out."
                                        >
                                          <AlertCircle size={10} />
                                          Last cycle failed
                                        </span>
                                      )}
                                      <span
                                        style={{
                                          fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 7px",
                                          background: isOwnerHistorical ? "rgb(238,235,231)" : isPaused ? "rgb(254,243,199)" : "rgb(220,247,228)",
                                          color: isOwnerHistorical ? "rgb(112,103,95)" : isPaused ? "rgb(146,64,14)" : "rgb(15,82,42)",
                                        }}
                                      >
                                        {isOwnerHistorical ? "Ended" : isPaused ? "Paused" : "Active"}
                                      </span>
                                      {/* History icon → opens the detail modal
                                          scoped to this schedule. Click stops
                                          propagation so the existing card-tap-
                                          to-expand behavior keeps working for
                                          the inline action buttons. The modal
                                          IS the rich "every cycle, every
                                          settlement, what's next" view —
                                          inline expand stays as the fast path
                                          for Pause/Add now/Edit/Cancel. */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openDetailScope({ kind: "schedule", scheduleId: idStr });
                                        }}
                                        title="View this schedule's history"
                                        aria-label="View this schedule's history"
                                        data-testid={`button-detail-schedule-${idStr}`}
                                        style={{
                                          width: 26, height: 26, borderRadius: 999,
                                          border: "1px solid rgba(26,67,50,0.18)",
                                          background: "rgba(26,67,50,0.06)",
                                          color: "rgb(26,67,50)",
                                          cursor: "pointer",
                                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                                          padding: 0,
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(26,67,50,0.14)")}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(26,67,50,0.06)")}
                                      >
                                        <History size={13} />
                                      </button>
                                    </div>
                                  </div>
                                  <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.55)", marginTop: 3 }}>
                                    {strategyLabel}
                                    {next && !isPaused ? ` · ${(!totalNum || totalNum <= 0) && !c.hasRecentFailure ? "first charge" : "next"} ${next.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}
                                  </p>
                                  {/* Total contributed pill — long-term commitment story.
                                      Only shows when there's been at least one cycle. */}
                                  {totalNum != null && totalNum > 0 && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                                      <span style={{
                                        fontSize: 10.5, fontWeight: 700,
                                        background: "rgb(237,244,238)",
                                        color: "rgb(26,67,50)",
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        letterSpacing: "0.02em",
                                      }}>
                                        {formatCurrency(totalNum)} added total
                                      </span>
                                      {last && (
                                        <span style={{ fontSize: 10.5, color: "rgb(155,144,136)" }}>
                                          last {last.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <ChevronDown
                                  size={16}
                                  style={{
                                    color: "rgb(155,144,136)",
                                    flexShrink: 0,
                                    marginTop: 10,
                                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s",
                                  }}
                                />
                              </div>

                              {/* Expanded detail + action chips. Note is the
                                  parent's "love letter" recurring memory —
                                  worth showing in full when expanded. */}
                              {isExpanded && (() => {
                                // Derived facts surfaced only on expand.
                                // Cycle count from totalContributed/amount —
                                // good-enough proxy without an extra query.
                                const cycleCount =
                                  amtNum != null && amtNum > 0 && totalNum != null
                                    ? Math.round(totalNum / amtNum)
                                    : null;
                                const startedDate = c.createdAt ? new Date(c.createdAt) : null;
                                const startedLabel = startedDate
                                  ? startedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
                                  : null;
                                const paymentSource = c.paymentSource as
                                  | { kind: "bank" | "card"; last4: string | null; label: string }
                                  | undefined;
                                const paymentSourceLabel = paymentSource
                                  ? paymentSource.last4
                                    ? `${paymentSource.label} •••• ${paymentSource.last4}`
                                    : paymentSource.label
                                  : null;
                                // Pause-reason humanization — `subscription_ended`
                                // is the load-bearing case (Plus plan lapsed →
                                // schedule auto-paused). Without explanation,
                                // parents wonder why and don't know to renew.
                                const pauseReason = isPaused && typeof c.pauseReason === "string" ? c.pauseReason : null;
                                const pauseReasonText = (() => {
                                  // Post-handoff owner view OR an explicit
                                  // majority_handoff pause: this is the former
                                  // parent's recurring, ended when the fund
                                  // transferred. Not "you paused this" and not
                                  // resumable by the owner.
                                  if (isOwnerHistorical || pauseReason === "majority_handoff") {
                                    return "This recurring was set up before the fund became yours. It ended at the handoff. The fund is fully yours now.";
                                  }
                                  if (!pauseReason) return null;
                                  if (pauseReason === "subscription_ended") {
                                    return "Auto-paused because Kiddo+ lapsed. Resume your subscription and this schedule turns back on.";
                                  }
                                  if (pauseReason === "user") return "You paused this. Resume anytime, no charge until the next scheduled date.";
                                  return null;
                                })();
                                return (
                                <div style={{ marginTop: 12, marginLeft: 48 }}>
                                  {/* Pause reason banner — only when paused
                                      AND we have a human reason. The
                                      subscription_ended case is the most
                                      important; it tells the parent WHY and
                                      WHAT to do. */}
                                  {pauseReasonText && (
                                    <div style={{
                                      background: pauseReason === "subscription_ended" ? "rgb(254,243,199)" : "rgb(243,240,236)",
                                      border: `1px solid ${pauseReason === "subscription_ended" ? "rgba(184,121,26,0.30)" : "rgba(26,23,16,0.10)"}`,
                                      borderRadius: 12,
                                      padding: "10px 12px",
                                      marginBottom: 12,
                                    }}>
                                      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: pauseReason === "subscription_ended" ? "rgb(146,108,46)" : "rgb(120,110,100)", marginBottom: 4 }}>
                                        {(isOwnerHistorical || pauseReason === "majority_handoff") ? "Ended at handoff" : pauseReason === "subscription_ended" ? "Action needed" : "Why this is paused"}
                                      </p>
                                      <p style={{ fontSize: 12.5, color: "rgb(60,52,42)", lineHeight: 1.45 }}>
                                        {pauseReasonText}
                                      </p>
                                    </div>
                                  )}
                                  {note && (
                                    <div style={{
                                      background: "rgb(253,250,243)",
                                      border: "1px solid rgba(184,121,26,0.18)",
                                      borderRadius: 12,
                                      padding: "10px 12px",
                                      marginBottom: 12,
                                    }}>
                                      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgb(146,108,46)", marginBottom: 4 }}>
                                        Memory note
                                      </p>
                                      <p style={{ fontSize: 12.5, color: "rgb(60,52,42)", lineHeight: 1.45, fontStyle: "italic" }}>
                                        "{note}"
                                      </p>
                                    </div>
                                  )}
                                  {/* Detail facts row — payment source,
                                      started date, cycle count. Lightweight
                                      meta-data band, not chrome-y. */}
                                  {(paymentSourceLabel || startedLabel || (cycleCount && cycleCount > 0)) && (
                                    <div style={{
                                      display: "flex", flexWrap: "wrap", gap: "4px 14px",
                                      marginBottom: 12,
                                      fontSize: 11.5, color: "rgb(110,100,90)",
                                    }}>
                                      {paymentSourceLabel && !isOwnerHistorical && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                          <span style={{ color: "rgb(155,144,136)" }}>Charges</span>
                                          <span style={{ color: "rgb(60,52,42)", fontWeight: 600 }}>{paymentSourceLabel}</span>
                                        </span>
                                      )}
                                      {startedLabel && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                          <span style={{ color: "rgb(155,144,136)" }}>Since</span>
                                          <span style={{ color: "rgb(60,52,42)", fontWeight: 600 }}>{startedLabel}</span>
                                        </span>
                                      )}
                                      {cycleCount != null && cycleCount > 0 && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                          <span style={{ color: "rgb(155,144,136)" }}>Fired</span>
                                          <span style={{ color: "rgb(60,52,42)", fontWeight: 600 }}>{cycleCount} {cycleCount === 1 ? "time" : "times"}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {/* No resume/pause/add/edit/cancel unless the
                                      schedule is YOURS. The server's record-scoped
                                      routes 403 anyone who isn't the record's
                                      creator (a co-admin/viewer co-parent, the
                                      post-handoff owner) — it's the creator's bank
                                      on file. The history stays visible above;
                                      the actions render only for the creator. */}
                                  {!isOwnerHistorical && String((c as any).userId ?? "") === String((user as any)?.id ?? "") && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    <button
                                      type="button"
                                      onClick={() => pauseToggleMutation.mutate({ id: idStr, status: isPaused ? "active" : "paused" })}
                                      disabled={isMutating}
                                      style={{
                                        fontSize: 11.5, fontWeight: 700,
                                        padding: "6px 11px", borderRadius: 999,
                                        background: isPaused ? "rgb(220,247,228)" : "rgb(254,243,199)",
                                        color: isPaused ? "rgb(15,82,42)" : "rgb(146,64,14)",
                                        border: "none",
                                        cursor: isMutating ? "wait" : "pointer",
                                        display: "inline-flex", alignItems: "center", gap: 4,
                                      }}
                                      data-testid={`button-pause-toggle-${idStr}`}
                                    >
                                      {isPaused ? <Play size={11} /> : <Pause size={11} />}
                                      {isPaused ? "Resume" : "Pause"}
                                    </button>
                                    {!isPaused && (
                                      <button
                                        type="button"
                                        onClick={() => contributeNowMutation.mutate(idStr)}
                                        disabled={isMutating}
                                        style={{
                                          fontSize: 11.5, fontWeight: 700,
                                          padding: "6px 11px", borderRadius: 999,
                                          background: "rgb(26,61,43)",
                                          color: "white",
                                          border: "none",
                                          cursor: isMutating ? "wait" : "pointer",
                                          display: "inline-flex", alignItems: "center", gap: 4,
                                        }}
                                        data-testid={`button-contribute-now-${idStr}`}
                                      >
                                        Add now
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/dashboard?fund=${c.fundId}&openAutoInvest=1&editId=${idStr}`)}
                                      style={{
                                        fontSize: 11.5, fontWeight: 700,
                                        padding: "6px 11px", borderRadius: 999,
                                        background: "transparent",
                                        color: "rgb(26,61,43)",
                                        border: "1px solid rgba(26,61,43,0.25)",
                                        cursor: "pointer",
                                        display: "inline-flex", alignItems: "center", gap: 4,
                                      }}
                                      data-testid={`button-edit-schedule-${idStr}`}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const ok = window.confirm("Cancel this recurring investment? It won't run again. You can always set up a new one.");
                                        if (ok) cancelScheduleMutation.mutate(idStr);
                                      }}
                                      disabled={isMutating}
                                      style={{
                                        fontSize: 11.5, fontWeight: 700,
                                        padding: "6px 11px", borderRadius: 999,
                                        background: "transparent",
                                        color: "rgb(170,38,38)",
                                        border: "1px solid rgba(170,38,38,0.25)",
                                        cursor: isMutating ? "wait" : "pointer",
                                        marginLeft: "auto",
                                      }}
                                      data-testid={`button-cancel-schedule-${idStr}`}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  )}
                                </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </EnlighteningReveal>
                )}

                {/* Gifter schedules — TWO kinds share this list, branched per
                    row on stripeSubscriptionId (the payload spreads the full
                    recurring_gifts row):
                      • auto-charge rows (real Stripe subscription): the gifter's
                        card charges automatically each cycle. For non-demo users
                        the phantom-row guard means these are the ONLY kind here.
                      • reminder-only rows (no sub id): we email the gifter a
                        nudge; nothing charges. Demo's seeded rows + future
                        reminder surfacing.
                    The old render treated everything as "reminder" — so a real
                    parent saw their gifter's AUTO-CHARGING schedule described
                    as "email reminder," and Stop claimed to stop emails while
                    (pre the 2026-06-04 server fix) leaving Stripe billing the
                    gifter forever. Labels, copy, and confirm now follow the
                    row's true kind. */}
                {scheduledReminders.length > 0 && (
                  <EnlighteningReveal>
                    <div style={{ marginBottom: 22 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgb(140,130,122)", marginBottom: 10 }}>
                        Gifter schedules
                      </p>
                      <div className="kiddo-card" style={{
                        padding: "0 18px",
                      }}>
                        {scheduledReminders.map((r: any, i: number) => {
                          const isLast = i === scheduledReminders.length - 1;
                          const next = r.nextChargeDate ? new Date(r.nextChargeDate) : null;
                          const amtNum = parseAmount(r.amount);
                          const isExpanded = expandedScheduledId === `rem:${r.id}`;
                          const idStr = String(r.id);
                          const isAutoCharge = Boolean(r.stripeSubscriptionId);
                          const isMutating = cancelReminderMutation.isPending && cancelReminderMutation.variables === idStr;
                          return (
                            <div
                              key={r.id}
                              style={{
                                padding: "14px 0",
                                borderBottom: isLast ? "none" : "1px solid rgba(26,23,16,0.06)",
                                opacity: isMutating ? 0.6 : 1,
                                transition: "opacity 0.15s",
                              }}
                              data-testid={`scheduled-reminder-${r.id}`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleScheduledExpand(`rem:${idStr}`)}
                                aria-expanded={isExpanded}
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 12,
                                  padding: 0,
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <div style={{
                                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                  background: "rgb(245,237,253)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  border: "1px solid rgba(126,68,180,0.18)",
                                }}>
                                  <BellRing size={16} style={{ color: "rgb(126,68,180)" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(26,23,16)" }}>
                                      {r.senderName || "Someone"} · {isAutoCharge ? "recurring" : "reminder"}
                                    </p>
                                    {amtNum != null && (
                                      <p style={{ fontSize: 13, fontWeight: 600, color: "rgb(120,110,100)" }}>
                                        {formatCurrency(amtNum)}/{r.frequency === "yearly" ? "yr" : r.frequency === "quarterly" ? "qtr" : "mo"}
                                      </p>
                                    )}
                                  </div>
                                  <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.55)", marginTop: 3 }}>
                                    {isAutoCharge
                                      ? `Gives to ${capFirst(r.recipientFirstName) || "the child"} automatically`
                                      : `Email reminder to gift ${capFirst(r.recipientFirstName) || "the child"}`}
                                    {next ? ` · next ${next.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : ""}
                                  </p>
                                </div>
                                <ChevronDown
                                  size={16}
                                  style={{
                                    color: "rgb(155,144,136)",
                                    flexShrink: 0,
                                    marginTop: 10,
                                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s",
                                  }}
                                />
                              </button>
                              {isExpanded && (
                                <div style={{ marginTop: 12, marginLeft: 48 }}>
                                  <p style={{ fontSize: 11.5, color: "rgb(120,110,100)", lineHeight: 1.45, marginBottom: 10 }}>
                                    {isAutoCharge
                                      ? `${r.senderName || "This gifter"} set up a recurring gift that charges their card automatically. They manage it from their gifter dashboard. Stopping it here cancels their schedule for this fund; they won't be charged again.`
                                      : `${r.senderName || "This gifter"} set up a recurring reminder when they gave. They manage pause/resume themselves from the email. You can stop the reminders entirely from here.`}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const ok = window.confirm(isAutoCharge
                                        ? `Stop ${r.senderName || "this gifter"}'s recurring gift? Their card won't be charged again for this fund.`
                                        : `Stop reminding ${r.senderName || "this gifter"}? They won't receive future reminder emails for this fund.`);
                                      if (ok) cancelReminderMutation.mutate(idStr);
                                    }}
                                    disabled={isMutating}
                                    style={{
                                      fontSize: 11.5, fontWeight: 700,
                                      padding: "6px 11px", borderRadius: 999,
                                      background: "transparent",
                                      color: "rgb(170,38,38)",
                                      border: "1px solid rgba(170,38,38,0.25)",
                                      cursor: isMutating ? "wait" : "pointer",
                                    }}
                                    data-testid={`button-cancel-reminder-${idStr}`}
                                  >
                                    {isAutoCharge ? "Stop this recurring gift" : "Stop reminders"}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </EnlighteningReveal>
                )}
              </>
            )}
          </motion.div>
        )}
        {/* ============================ END SCHEDULED TAB ============================ */}

        <div className="h-24 md:hidden" />
        <TrustMicroStrip />
      </main>

      {/* Detail history modal — scoped per recurring schedule OR aggregating
          all parent contributions. Rendered at the page root (above bottom-
          nav z-index) so it can overlay any tab. Props are computed via IIFE
          off the active detailScope so the same modal handles every scope. */}
      {(() => {
        if (!detailScope) return null;
        const allFeed = activities as FeedActivity[];

        if (detailScope.kind === "schedule") {
          const schedule = scheduledContribs.find((c: any) => String(c.id) === detailScope.scheduleId);
          if (!schedule) return null;
          // Handoff-ended recurring: the modal stays as read-only history, but
          // drop the "Manage recurring" CTA — it deep-links to a manage sheet
          // that 403s on the former parent's plan.
          const scheduleOwnerHistorical = (schedule as any).pauseReason === "majority_handoff";
          // Filter rows to those linked to THIS schedule via metadata.
          const scopedRows = allFeed.filter((row) => {
            const meta = parseMetadata((row as any).metadata);
            const pcId = typeof (meta as any).parentContributionId === "string" ? (meta as any).parentContributionId : null;
            if (pcId !== detailScope.scheduleId) return false;
            // Suppress the gift_received row for parent contributions —
            // the parent_contribution row already covers it (one entry per
            // money event, not two). Same de-dupe rule as the main feed.
            const t = normalizeActivityType(row.type);
            if (t === "gift_received" && (meta as any).isParentContribution === true) return false;
            return true;
          });
          // Summary stats — total invested, cycles fired, avg cycle, started.
          // Cycle count is derived from totalContributed/amount when the
          // server hasn't supplied an explicit count. Keeps this modal
          // independent of API changes.
          const amt = parseAmount(schedule.amount);
          const total = parseAmount(schedule.totalContributed) ?? 0;
          const cycles = amt && amt > 0 ? Math.round(total / amt) : scopedRows.filter((r) => normalizeActivityType(r.type) === "parent_contribution").length;
          const startedDate = schedule.createdAt ? new Date(schedule.createdAt) : null;
          const ticker = schedule.executionModel === "pick" && typeof schedule.selectedTicker === "string" ? schedule.selectedTicker.toUpperCase() : null;
          const destLabel = ticker
            ? `into ${ticker}`
            : schedule.executionModel === "family"
              ? "into family mix"
              : // See comment on the strategyLabel twin in this file
                // (~line 3360) — "managed mix" unified to "diversified
                // mix" 2026-05-20. Same reasoning applies here.
                "into the full mix";
          const isPaused = schedule.status === "paused";
          // Payment method + next-charge info now lands in the hero
          // (subtitle + stats grid) instead of a recursive Scheduled tab
          // that just re-displayed the schedule the parent had already
          // tapped. Modal becomes History | Pending — the only views
          // that carry new info beyond the trigger card.
          const paymentSource = (schedule as any).paymentSource as
            | { kind: "bank" | "card"; last4: string | null; label: string }
            | undefined;
          const pmLabel = paymentSource
            ? paymentSource.last4 ? `${paymentSource.label} •••• ${paymentSource.last4}` : paymentSource.label
            : null;
          const nextRunDate = schedule.nextRunDate ? new Date(schedule.nextRunDate) : null;
          const nextChargeLabel = isPaused
            ? "Paused"
            : nextRunDate && Number.isFinite(nextRunDate.getTime())
              ? nextRunDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
              : "Not scheduled";
          const stats: DetailStat[] = [
            { label: "Total invested", value: formatCurrency(total), tone: total > 0 ? "positive" : "neutral" },
            { label: "Cycles fired", value: cycles > 0 ? `${cycles} ${cycles === 1 ? "cycle" : "cycles"}` : "Not yet", tone: "neutral" },
            // Replaces "Cycle amount" — the cycle amount is already in
            // the modal title ($25.00/mo). "Next charge" is the question
            // the parent actually asks looking at this surface.
            // Never-fired schedule reads "First charge" not "Next charge" — a
            // schedule that has run 0 cycles ($0 invested) alongside a "Next
            // charge" label reads as broken ("why has my monthly done nothing?").
            // "First charge" makes the 0/$0 coherent: it simply hasn't run yet.
            { label: cycles === 0 && !isPaused ? "First charge" : "Next charge", value: nextChargeLabel, tone: isPaused ? "neutral" : "positive" },
            { label: "Started", value: startedDate ? startedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Not yet", tone: "neutral" },
          ];
          // Subtitle merges destination + payment method so "where" and
          // "how it's paid" read at a glance.
          const subtitleParts = [destLabel];
          if (pmLabel) subtitleParts.push(pmLabel);
          if (isPaused) subtitleParts.push("paused");
          const composedSubtitle = subtitleParts.join(" · ");
          return (
            <DetailHistoryModal
              open
              onClose={closeDetailScope}
              title={`${ticker || "Recurring"} · ${amt != null ? formatCurrency(amt) : ""}/${schedule.frequency === "weekly" ? "wk" : schedule.frequency === "yearly" ? "yr" : "mo"}`}
              subtitle={composedSubtitle}
              summaryStats={stats}
              rows={scopedRows}
              bottomCta={scheduleOwnerHistorical ? undefined : {
                // Deep-link Dashboard's Edit / Pause / Cancel action sheet
                // via ?openManage={id}. Single management surface across
                // both modals — same label, same destination, no
                // surprise. Was opening Dashboard's full edit modal
                // directly, which hid pause/cancel behind another tap.
                label: "Manage recurring →",
                onClick: () => {
                  closeDetailScope();
                  navigate(`/dashboard?fund=${schedule.fundId}&openManage=${schedule.id}`);
                },
                testId: "detail-modal-manage-recurring",
              }}
            />
          );
        }

        // Contributions scope — every parent contribution in the active
        // period (sub-toggle further narrows to recurring-only / one-time-only).
        // "One-time" = parent contributions with no parentContributionId.
        // "Recurring" = parent contributions WITH a parentContributionId.
        // "All" = both.
        // senderEmail fallback for parent identification — catches every
        // row that pre-dates the server-stamped isParentContribution flag.
        // Without it, the contributions modal silently misses historical
        // parent gifts that match by email but lack the metadata flag.
        const ownerEmailLowerForFilter = String((user as any)?.email || "").trim().toLowerCase();
        const rowSenderEmail = (row: FeedActivity): string => {
          const enriched = row as any;
          const m = parseMetadata(enriched.metadata);
          const raw = typeof enriched.senderEmail === "string"
            ? enriched.senderEmail
            : (typeof (m as any).senderEmail === "string" ? (m as any).senderEmail : "");
          return String(raw || "").trim().toLowerCase();
        };
        const isRecurringRow = (row: FeedActivity): boolean => {
          const meta = parseMetadata((row as any).metadata);
          // Canonical signal: row was created by the recurring worker, which
          // stamps parentContributionId into metadata.
          if (typeof (meta as any).parentContributionId === "string" && !!(meta as any).parentContributionId) return true;
          // Legacy fallback for rows that pre-date the parentContributionId
          // column wiring. The boilerplate "Auto-invest contribution to {fund}"
          // message is the only evidence those historical rows came from a
          // schedule — same fallback the Dashboard recent-gifts feed uses to
          // surface the ↻ Recurring chip on legacy rows (see Dashboard.tsx
          // ~line 10517-10520 comment). Without this fallback, legacy
          // recurring gifts silently fall into the One-time tab — user
          // surfaced this as "is this accurate? im in the one time tab"
          // (2026-05-11). The boilerplate format is locked enough to be a
          // safe fallback: parents writing real notes essentially never
          // produce this exact phrase.
          const message = typeof (meta as any).message === "string" ? (meta as any).message : "";
          return /^auto-invest contribution to /i.test(message);
        };
        const isParentContribRow = (row: FeedActivity): boolean => {
          const t = normalizeActivityType(row.type);
          if (t === "parent_contribution" || t === "parent_contribution_failed") return true;
          if (t === "gift_received" || t === "gift_received_cash") {
            const meta = parseMetadata((row as any).metadata);
            if ((meta as any).isParentContribution === true) return true;
            if (ownerEmailLowerForFilter && rowSenderEmail(row) === ownerEmailLowerForFilter) return true;
          }
          return false;
        };
        // Owner-mode attribution: who actually made each contribution. Anything
        // added BEFORE the handoff was the parent's ("Dad added $50"); anything
        // since is the owner's own ("You added $50"). Split on the handoff date
        // (transferredAt). The stored title is first-person from the parent's
        // POV at creation ("You contributed $50"), which reads wrong once the
        // grown kid owns the fund — this re-attributes it. The parent's legacy
        // rows aren't the owner's to dispute, so we suppress Report-an-issue.
        const ownerFundObj = (allFundsForOwnerMode as any[]).find(
          (f) => String(f?.id) === String(activeFundIdForActivity),
        );
        const custodianAddedLabel =
          (ownerFundObj?.previousOwnerCallMe && String(ownerFundObj.previousOwnerCallMe).trim()) || "Your parent";
        const ownerHandoffAt = ownerFundObj?.transferredAt ? parseSafeDate(ownerFundObj.transferredAt) : null;
        const contribIsParents = (row: FeedActivity): boolean => {
          if (!activeFundIsOwned) return false;
          const created = parseSafeDate(row.createdAt);
          return !ownerHandoffAt || !created || created.getTime() < ownerHandoffAt.getTime();
        };
        // Row display transform: rewrite gift_received → parent_contribution
        // visuals so the modal renders a contribution row, not "Gift from X".
        // In owner mode it also re-attributes the title (parent vs owner).
        const applyParentContribDisplay = (row: FeedActivity): FeedActivity => {
          const t = normalizeActivityType(row.type);
          const isContribType = t === "parent_contribution" || t === "parent_contribution_failed";
          let isOverrideGift = false;
          if (!isContribType && (t === "gift_received" || t === "gift_received_cash" || t === "gift_invested")) {
            const meta = parseMetadata((row as any).metadata);
            isOverrideGift =
              (meta as any).isParentContribution === true ||
              (!!ownerEmailLowerForFilter && rowSenderEmail(row) === ownerEmailLowerForFilter);
          }
          if (!isContribType && !isOverrideGift) return row;
          const amtNum = parseAmount(row.amount);
          const amtStr = `$${(amtNum != null ? amtNum : 0).toFixed(2)}`;
          // Owner mode: attribute by who added it.
          if (activeFundIsOwned) {
            const parents = contribIsParents(row);
            const out: any = {
              ...row,
              type: "parent_contribution" as any,
              title: parents ? `${custodianAddedLabel} added ${amtStr}` : `You added ${amtStr}`,
            };
            // De-noise the "wall": recurring contributions all carry the same
            // boilerplate note ("Every month, a little more…"), already conveyed
            // by the header — drop it on recurring rows so the list reads as a
            // clean dated ledger. Keep it on one-time contributions (meaningful).
            if (isRecurringRow(row)) out.description = undefined;
            if (parents) out.__suppressReport = true;
            return out as FeedActivity;
          }
          // Parent mode (unchanged): parent_contribution rows keep their stored
          // title; overridden gift rows render as "You added $X".
          if (isContribType) return row;
          const meta = parseMetadata((row as any).metadata);
          const tickerRaw = (meta as any).ticker;
          const ticker = typeof tickerRaw === "string" ? tickerRaw.toUpperCase() : null;
          return {
            ...row,
            type: "parent_contribution" as any,
            title: `You added ${amtStr}`,
            description: ticker ? `Investing into ${ticker}` : "Investing across the full mix",
          };
        };
        const allContribRows = allFeed.filter(isParentContribRow).map(applyParentContribDisplay);
        // Owner mode: has the owner added any of their OWN contributions since
        // the handoff? Drives whether the header stays "from your parent" (only
        // the parent's legacy contributions) or goes neutral ("Contributions")
        // once the owner has started their own. ownerAllTotal powers the story
        // subtitle ("Dad added $X across N, before this became yours").
        const hasOwnContribs = activeFundIsOwned && allContribRows.some((r) => !contribIsParents(r));
        const ownerAllTotal = allContribRows.reduce((s, r) => {
          const n = parseAmount(r.amount);
          return s + (n != null && n > 0 ? n : 0);
        }, 0);
        const subFilteredRows = allContribRows.filter((row) => {
          if (contributionsSubFilter === "all") return true;
          const recurring = isRecurringRow(row);
          if (contributionsSubFilter === "recurring") return recurring;
          if (contributionsSubFilter === "onetime") return !recurring;
          return true;
        });
        const recurringCount = allContribRows.filter(isRecurringRow).length;
        const onetimeCount = allContribRows.length - recurringCount;
        const totalAdded = subFilteredRows.reduce((s, r) => {
          const n = parseAmount(r.amount);
          return s + (n != null && n > 0 ? n : 0);
        }, 0);
        const avgAdded = subFilteredRows.length > 0 ? totalAdded / subFilteredRows.length : 0;
        const lastDate = (() => {
          let latest: Date | null = null;
          for (const r of subFilteredRows) {
            const d = parseSafeDate(r.createdAt);
            if (d && (!latest || d.getTime() > latest.getTime())) latest = d;
          }
          return latest;
        })();
        const stats: DetailStat[] = [
          { label: "Total added", value: formatCurrency(totalAdded), tone: totalAdded > 0 ? "positive" : "neutral" },
          { label: "Times added", value: `${subFilteredRows.length}`, tone: "neutral" },
          { label: "Average", value: subFilteredRows.length > 0 ? formatCurrency(avgAdded) : formatCurrency(0), tone: "neutral" },
          { label: "Most recent", value: lastDate ? lastDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "None yet", tone: "neutral" },
        ];
        return (
          <DetailHistoryModal
            open
            onClose={closeDetailScope}
            title={
              activeFundIsOwned
                ? (hasOwnContribs ? "Contributions" : "Contributions from your parent")
                : "Your investments"
            }
            subtitle={
              activeFundIsOwned
                ? (hasOwnContribs
                    ? `What ${custodianAddedLabel} added before the handoff, and what you've added since.`
                    : `${custodianAddedLabel} added ${formatCurrency(ownerAllTotal)} across ${allContribRows.length} ${allContribRows.length === 1 ? "contribution" : "contributions"}, before this became yours.`)
                : "Every dollar you've added to this fund."
            }
            summaryStats={stats}
            subToggle={{
              options: [
                { value: "all", label: "All", count: allContribRows.length },
                { value: "recurring", label: "Recurring", count: recurringCount },
                { value: "onetime", label: "One-time", count: onetimeCount },
              ],
              value: contributionsSubFilter,
              onChange: (v) => setContributionsSubFilter(v as typeof contributionsSubFilter),
            }}
            rows={subFilteredRows}
          />
        );
      })()}
    </div>
  );
}
