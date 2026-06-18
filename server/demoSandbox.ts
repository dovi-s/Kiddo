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

// ── Demo write-guard ─────────────────────────────────────────────────────────
// A demo VISITOR logs in as a SHARED demo account (phil@/robert@riverafamily.com).
// The money-flow endpoints already self-sandbox (mock responses above). But the
// REST of the mutation surface would PERSIST to the shared demo and pollute it
// for the next visitor — or, worst case, LOCK it (2FA enroll, password change)
// or HIJACK it (email change, account delete). This middleware blocks persisting
// writes from demo accounts:
//   - PATCH / PUT / DELETE: blanket-blocked. These are always mutations; no read
//     or money-flow endpoint uses them.
//   - POST: blocked only for the known mutation paths below — so read-via-POST,
//     the money-flow mocks, /auth/login, and /auth/register still pass through.
// Real (non-demo) users are NEVER affected (gated on req.user.isDemoAccount).
// Returns 200 with a benign {demo, saved:false} body so the client cleanly
// no-ops (a refetch shows the unchanged demo) instead of surfacing a scary
// error. Keep DEMO_BLOCKED_POST_PATTERNS in sync as new persisting POSTs land.
// Mapped from the full mutation-surface audit, 2026-06-05.
const DEMO_BLOCKED_POST_PATTERNS: RegExp[] = [
  // Catastrophic — lock or hijack the shared demo account
  /^\/api\/user\/change-password$/,
  /^\/api\/me\/change-email$/,
  /^\/api\/auth\/2fa(\/|$)/,
  /^\/api\/account\/delete$/,
  // Profile / settings
  /^\/api\/user\/feature-walls\/[^/]+\/dismiss$/,
  /^\/api\/users\/me\/(roth-interest|earned-income)$/,
  // Fund + child content
  /^\/api\/funds\/[^/]+\/child-photo$/,
  /^\/api\/funds\/[^/]+\/gift-code\/reset$/,
  /^\/api\/funds\/[^/]+\/memory(\/|$)/, // add + photo/video/audio uploads
  /^\/api\/memory\/[^/]+\/approve$/,
  /^\/api\/funds\/[^/]+\/collaborators$/,
  /^\/api\/funds\/[^/]+\/welcome-complete$/,
  /^\/api\/funds\/[^/]+\/(snooze|unsnooze)-action$/,
  // Events / occasions
  /^\/api\/events$/,
  /^\/api\/events\/[^/]+\/upload-image$/,
  // Gifter-side
  /^\/api\/gifter-account\/funds\/[^/]+\/(follow|unfollow)$/,
  /^\/api\/gifter-account\/save-fund$/,
  /^\/api\/gifter-account\/recurring\/[^/]+\/(cancel|pause|resume|update)$/,
  // Thank-yous + gifter notifications (writes the seeded tray)
  /^\/api\/funds\/[^/]+\/gifter-notifications\/(remove|memory-share)$/,
  /^\/api\/funds\/[^/]+\/thank-yous\/[^/]+\/send$/,
  /^\/api\/funds\/[^/]+\/thank-yous\/bulk-send$/,
  /^\/api\/funds\/[^/]+\/thank-yous\/generate$/,
  // Kid View
  /^\/api\/funds\/[^/]+\/kid-view-link$/,
  // Banking — NEVER link a real bank to the shared demo account. A demo visitor
  // completing Plaid would persist a real person's bank details on the demo user,
  // visible to the next visitor (a privacy leak, not just state pollution).
  // PATCH/DELETE on bank-accounts are already caught as hard writes; these cover
  // the POSTs: Plaid link-token + exchange-public-token, and bank-account create.
  /^\/api\/plaid(\/|$)/,
  /^\/api\/bank-accounts(\/|$)/,
];

export function blockDemoMutations(req: any, res: any, next: any) {
  if (!req.user?.isDemoAccount) return next();
  const p = String(req.path || "");
  if (!p.startsWith("/api/")) return next();
  const method = req.method;
  const isHardWrite = method === "PATCH" || method === "PUT" || method === "DELETE";
  const isBlockedPost = method === "POST" && DEMO_BLOCKED_POST_PATTERNS.some((re) => re.test(p));
  if (!isHardWrite && !isBlockedPost) return next();
  return res.status(200).json({
    demo: true,
    saved: false,
    // Framed to REASSURE, not just block: the feature works — it just doesn't
    // persist in the shared demo. The client surfaces this as a subtle toast
    // (see client/src/lib/queryClient.ts) so a blocked edit reads as "demo,"
    // not "broken."
    message: "Changes aren't saved here in the demo, but they will be in your own fund.",
  });
}
