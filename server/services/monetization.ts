// Monetization service — extracted from routes.ts.
//
// SCOPE: every closure-bound helper in registerRoutes that touched
// subscription / fund-membership / trial / coverage state. Lives here as
// a module so route modules (server/routes/*.ts) can import directly
// instead of taking a 12-dep object.
//
// State model:
//   - Subscription + fund-membership entitlement reads from Postgres
//     (via storage.getSubscription / storage.getFundMembership /
//     storage.getFundMembershipsByUser).
//   - Trial state and reverseTrialEnabled flag live in
//     `.local/monetization-state.json`. Cached in a module-level var so
//     every read after the first is in-memory. Writes invalidate.
//
// Why JSON not Postgres for trial state: the dataset is tiny (one row
// per fund that ever entered a trial, plus one global flag). Migration
// to Postgres is a future session — see ARCHITECTURE.md §11 "Remaining
// JSON state files." When that happens, only `loadMonetizationState`
// and `saveMonetizationState` need to change; every public function
// keeps its signature.
//
// Pure-function note: `hasEntitlementFromStatus` is included here even
// though it has nothing to do with trials specifically — it's the
// foundational predicate for "is this subscription/membership active?"
// used by every other helper in this file. Keeping it co-located saves
// a separate import for every consumer.

import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../db";
import { storage } from "../storage";
import { activities } from "@shared/schema";
import {
  KIDDO_REVERSE_TRIAL_DAYS,
  KORA_FAMILY_MONTHLY,
  KORA_STARTER_MONTHLY,
  type FundCoverageState,
  type RecommendationState,
} from "@shared/monetization";

// ─── Entitlement predicate ──────────────────────────────────────────

// "Active" or "canceled but currentPeriodEnd is still in the future."
// The canceled-but-not-yet-expired branch is the one that catches
// users who hit cancel mid-period — they keep entitlement until the
// period actually ends. Without this branch, cancel would feel like
// a hard cutoff and we'd be in dark-pattern territory the other way
// (charging for a period the user can't use).
export function hasEntitlementFromStatus(
  status?: string | null,
  currentPeriodEnd?: Date | string | null,
): boolean {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return true;
  if (normalized !== "canceled") return false;
  if (!currentPeriodEnd) return true;
  const end = new Date(currentPeriodEnd);
  return !Number.isNaN(end.getTime()) && end.getTime() > Date.now();
}

// ─── Subscription + membership reads ────────────────────────────────

export async function getActiveHouseholdPlan(
  userId: string | null | undefined,
): Promise<"legacy" | "family" | null> {
  if (!userId) return null;
  const subscription = await storage.getSubscription(userId);
  if (!subscription) return null;
  if (
    (subscription.plan === "legacy" || subscription.plan === "family") &&
    hasEntitlementFromStatus(subscription.status, subscription.currentPeriodEnd)
  ) {
    return subscription.plan as "legacy" | "family";
  }
  return null;
}

export async function hasStarterPlanForFund(
  userId: string | null | undefined,
  fundId: string | null | undefined,
): Promise<boolean> {
  if (!userId || !fundId) return false;
  const membership = await storage.getFundMembership(userId, fundId);
  if (!membership || membership.plan !== "starter") return false;
  return hasEntitlementFromStatus(membership.status, membership.currentPeriodEnd);
}

// Sponsored-subscription detection (Prong B of pricing-v3 conversion
// architecture, locked 2026-05-23 in
// project_gifter_sponsors_plus_subscription.md). A gifter purchased
// a year of Plus or Family for the fund; this returns the active
// sponsorship tier if one exists, or null. Unlike hasStarterPlanForFund
// this is FUND-scoped (not user-scoped) because sponsored subs belong
// to the fund, not to the parent's user record — the parent didn't
// pay, the gifter did.
//
// Used by getFundCoverageState to OR sponsored coverage into the
// standard coverage detection. A sponsored fund returns
// covered_starter (or covered_family) so the existing gating logic
// at /api/funds/:fundId/parent-contributions + /api/stripe/checkout/
// gift-recurring etc. all "just work" — no changes needed to those
// endpoints to honor sponsored coverage.
export async function getActiveSponsorshipForFund(
  fundId: string | null | undefined,
): Promise<{ tier: "starter" | "family"; sponsorEmail: string; sponsorName: string | null; expiresAt: Date } | null> {
  if (!fundId) return null;
  const { db } = await import("../db");
  const { sponsoredSubscriptions } = await import("@shared/schema");
  const { and, eq, gt, sql } = await import("drizzle-orm");
  const [row] = await db
    .select({
      tier: sponsoredSubscriptions.tier,
      sponsorEmail: sponsoredSubscriptions.sponsorEmail,
      sponsorName: sponsoredSubscriptions.sponsorName,
      expiresAt: sponsoredSubscriptions.expiresAt,
    })
    .from(sponsoredSubscriptions)
    .where(and(
      eq(sponsoredSubscriptions.fundId, fundId),
      eq(sponsoredSubscriptions.status, "active"),
      gt(sponsoredSubscriptions.expiresAt, sql`NOW()`),
    ))
    .limit(1);
  if (!row) return null;
  // Defensive: only return rows with a valid tier value. Anything
  // else is data corruption and shouldn't unlock coverage.
  if (row.tier !== "starter" && row.tier !== "family") return null;
  return {
    tier: row.tier,
    sponsorEmail: row.sponsorEmail,
    sponsorName: row.sponsorName,
    expiresAt: row.expiresAt,
  };
}

export async function getActiveStarterMembershipsForUser(
  userId: string | null | undefined,
) {
  if (!userId) return [];
  const memberships = await storage.getFundMembershipsByUser(userId);
  return memberships.filter(
    (membership) =>
      membership.plan === "starter" &&
      !!membership.stripeSubscriptionId &&
      hasEntitlementFromStatus(membership.status, membership.currentPeriodEnd),
  );
}

export async function hasPaidPlanForFund(
  userId: string | null | undefined,
  fundId: string | null | undefined,
) {
  const [householdPlan, starter] = await Promise.all([
    getActiveHouseholdPlan(userId),
    hasStarterPlanForFund(userId, fundId),
  ]);
  const legacy = householdPlan === "legacy";
  const family = householdPlan === "family" || legacy;

  // Post-handoff owner entitlement. Once a fund transfers to the kid at majority,
  // the owner is NEVER charged a subscription (locked "subscription retires at
  // majority" rule — AUM is the only post-handoff revenue), but they still own
  // the fund and get its paid features for free: occasions, custom mix, owner-
  // authored Memory Book media, etc. Treat the current owner of a transferred
  // fund as Plus-equivalent so nothing paywalls them. Their gifters inherit this
  // fund tier too — the intended kid-2.0 behavior (gifts keep coming with full
  // features). Plus-equivalent (not Family) because it's a single owned fund.
  if (userId && fundId) {
    try {
      const fund = await storage.getFund(fundId);
      if (fund && (fund as any).transferredAt && String(fund.userId) === String(userId)) {
        return {
          legacy: false,
          family: false,
          starter: true,
          paid: true,
          hostPlan: "starter",
        } as const;
      }
    } catch {
      // Non-fatal — fall through to the subscription-based result below.
    }
  }

  return {
    legacy,
    family,
    starter,
    paid: family || starter,
    hostPlan: legacy ? "legacy" : family ? "family" : starter ? "starter" : "free",
  } as const;
}

// ─── Trial state (JSON-backed, cached) ──────────────────────────────

export type TrialState = {
  fundId: string;
  userId: string;
  startedAt: string;
  expiresAt: string;
  restartEligibleAt?: string | null;
};

type MonetizationState = {
  reverseTrialEnabled?: boolean;
  trials: Record<string, TrialState>;
};

const MONETIZATION_STATE_PATH = path.join(process.cwd(), ".local", "monetization-state.json");
let monetizationStateCache: MonetizationState | null = null;

async function loadMonetizationState(): Promise<MonetizationState> {
  if (monetizationStateCache) return monetizationStateCache;
  try {
    const raw = await fs.readFile(MONETIZATION_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    const safe = parsed && typeof parsed === "object" ? parsed : {};
    monetizationStateCache = {
      reverseTrialEnabled: Boolean((safe as any).reverseTrialEnabled),
      trials:
        (safe as any).trials && typeof (safe as any).trials === "object"
          ? (safe as any).trials
          : {},
    };
  } catch {
    monetizationStateCache = { trials: {} };
  }
  return monetizationStateCache;
}

async function saveMonetizationState(next: MonetizationState): Promise<MonetizationState> {
  monetizationStateCache = next;
  await fs.mkdir(path.dirname(MONETIZATION_STATE_PATH), { recursive: true });
  await fs.writeFile(MONETIZATION_STATE_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

// Force a reload from disk on next call. Used by admin endpoints that
// edit the JSON file out-of-band.
export function invalidateMonetizationStateCache(): void {
  monetizationStateCache = null;
}

export async function isReverseTrialEnabled(): Promise<boolean> {
  const state = await loadMonetizationState();
  return Boolean(state.reverseTrialEnabled);
}

export async function setReverseTrialEnabled(enabled: boolean): Promise<MonetizationState> {
  const state = await loadMonetizationState();
  state.reverseTrialEnabled = enabled;
  return saveMonetizationState(state);
}

export async function getTrialForFund(fundId: string): Promise<TrialState | null> {
  const state = await loadMonetizationState();
  const trial = state.trials?.[fundId];
  if (!trial) return null;
  return trial;
}

export async function startTrialForFund(userId: string, fundId: string): Promise<TrialState> {
  const state = await loadMonetizationState();
  const startedAt = new Date();
  const expiresAt = new Date(
    startedAt.getTime() + KIDDO_REVERSE_TRIAL_DAYS * 24 * 60 * 60 * 1000,
  );
  state.trials ||= {};
  state.trials[fundId] = {
    fundId,
    userId,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    restartEligibleAt: null,
  };
  await saveMonetizationState(state);
  return state.trials[fundId];
}

// ─── Coverage / recommendation derivation ───────────────────────────

export async function getFundCoverageState(
  userId: string | null | undefined,
  fundId: string | null | undefined,
): Promise<FundCoverageState> {
  if (!fundId) return "uncovered";
  const [householdPlan, starter, trial, sponsorship] = await Promise.all([
    getActiveHouseholdPlan(userId),
    hasStarterPlanForFund(userId, fundId),
    getTrialForFund(fundId),
    getActiveSponsorshipForFund(fundId),
  ]);
  if (householdPlan) return "covered_family";
  if (starter) return "covered_starter";
  // Sponsored coverage: a gifter purchased Plus or Family for this
  // fund (Prong B of pricing-v3 conversion). Sponsored Family returns
  // covered_family; sponsored Plus returns covered_starter. The
  // resulting coverage gates identically to direct customer subs.
  // Per project_gifter_sponsors_plus_subscription.md.
  if (sponsorship) {
    return sponsorship.tier === "family" ? "covered_family" : "covered_starter";
  }
  if (trial) {
    const expiresAt = new Date(trial.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now()) return "trial_active";
    return "trial_expired";
  }
  return "uncovered";
}

// Recommendation state for the per-fund-membership plan ladder.
// "family_recommended" once the math says Family is cheaper than the
// equivalent count of Starter subs at full price. The ceil() handles
// the case where one extra dollar of Starter would already exceed
// Family — at that point Family wins and we should suggest it.
export function getRecommendationState(
  activeStarterCount: number,
  familyEntitled: boolean,
): RecommendationState {
  if (familyEntitled || activeStarterCount >= Math.ceil(KORA_FAMILY_MONTHLY / KORA_STARTER_MONTHLY)) {
    return "family_recommended";
  }
  if (activeStarterCount <= 0) return "free";
  if (activeStarterCount === 1) return "mixed";
  return "all_starter_covered";
}

// ─── Strategy gate ──────────────────────────────────────────────────

// Custom strategy is a paid feature. Free users get the requested
// strategy normalized to a free-tier-eligible one (anything except
// "custom"). Defaults to "growth" when input is malformed or when the
// gate denies the upgrade.
export async function resolveAllowedFundStrategy(
  userId: string | null | undefined,
  fundId: string | null | undefined,
  requested: any,
): Promise<"growth" | "balanced" | "conservative" | "custom"> {
  const raw = String(requested || "growth").trim().toLowerCase();
  const normalized = raw === "auto_invest" ? "growth" : raw;
  if (!["growth", "balanced", "conservative", "custom"].includes(normalized)) return "growth";
  if (normalized !== "custom") return normalized as "growth" | "balanced" | "conservative";
  if (!userId) return "growth";
  // Post-handoff owner customizes their own mix FREE — same logic as
  // owner-recurring: the Plus sub is a custodian product that retires at
  // majority, and picking your own holdings is table-stakes on a self-directed
  // account. The Plus custom-mix gate is for the CUSTODIAN choosing a kid's
  // allocation, not the owner allocating their own. Per LIFECYCLE_MONETIZATION.md.
  if (fundId) {
    try {
      const ownFund = await storage.getFund(fundId);
      if (ownFund && (ownFund as any).transferredAt && (ownFund as any).userId === userId) return "custom";
    } catch { /* fall through to the paid-plan check */ }
  }
  const paid = await hasPaidPlanForFund(userId, fundId);
  return paid.paid ? "custom" : "growth";
}

// ─── Activity log helper ────────────────────────────────────────────

// Best-effort write to `activities`. Errors are swallowed and logged —
// monetization state changes should never fail a Stripe webhook or
// route handler because the activity insert hit a constraint.
export async function logMonetizationActivity(
  userId: string,
  fundId: string | null,
  type: string,
  title: string,
  description: string,
  metadata?: Record<string, unknown>,
  amount?: number | null,
): Promise<void> {
  try {
    await db.insert(activities).values({
      userId,
      fundId,
      type,
      title,
      description,
      amount: amount != null ? amount.toFixed(2) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (err) {
    console.error("Failed to log monetization activity:", err);
  }
}
