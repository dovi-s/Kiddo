// Demo account sandboxing. Per DUNPHY_DEMO_SPEC.md Phase 2.
//
// Money-flow endpoints check `isDemoFund(fundId)` and return mock
// success responses for demo-owned funds instead of touching real
// Stripe / DriveWealth. Two goals:
//   1. Visitors to the demo can "try" sending a gift / setting up
//      recurring / withdrawing without hitting real payment rails
//   2. Demo state stays self-contained — no Stripe webhook firing,
//      no DriveWealth order, no real ACH transfer, no real card charge
//
// Pattern: import this helper into each money-flow endpoint, branch
// at the top. Same shape as the existing isTestUser filter in
// gifterNotificationWorker.ts but at the FUND level rather than the
// USER level — that's because gifts come in from anonymous gifters
// who don't have a Kora account, but the fund's parent is the demo
// flag carrier.

import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Cache the fund→isDemo lookup briefly so repeated checks within a
// single request don't refetch the user row. 30s TTL is plenty —
// demo-account flags don't change at runtime in practice.
const fundDemoCache = new Map<string, { isDemo: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

export async function isDemoFund(fundId: string | null | undefined): Promise<boolean> {
  if (!fundId) return false;
  const cached = fundDemoCache.get(fundId);
  if (cached && cached.expiresAt > Date.now()) return cached.isDemo;

  try {
    const fund = await storage.getFund(fundId);
    if (!fund) {
      fundDemoCache.set(fundId, { isDemo: false, expiresAt: Date.now() + CACHE_TTL_MS });
      return false;
    }
    const [owner] = await db.select({ isDemo: users.isDemoAccount }).from(users).where(eq(users.id, fund.userId)).limit(1);
    const isDemo = Boolean(owner?.isDemo);
    fundDemoCache.set(fundId, { isDemo, expiresAt: Date.now() + CACHE_TTL_MS });
    return isDemo;
  } catch {
    return false;
  }
}

export async function isDemoUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const [row] = await db.select({ isDemo: users.isDemoAccount }).from(users).where(eq(users.id, userId)).limit(1);
    return Boolean(row?.isDemo);
  } catch {
    return false;
  }
}

// Standard mock response for demo money-flow attempts. Keeps the UX
// flow alive (the redirect/success state fires) but no real payment
// rails are touched. Used by the gift checkout, parent contribution,
// invest, withdrawal, and billing portal endpoints.
export function demoMockCheckoutResponse(returnUrl?: string) {
  const safeUrl = returnUrl || "/dashboard?demo=1";
  return {
    isDemo: true,
    url: safeUrl,
    sessionId: `demo_${Date.now()}`,
    message: "This is a demo account. The flow completes without charging a card or moving real money.",
  };
}
