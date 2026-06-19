// Regression guard for the demo write-sandbox (server/demoSandbox.ts).
//
// Why this exists: DEMO_BLOCKED_POST_PATTERNS is a hand-maintained ALLOWLIST.
// On 2026-06-18 a SELL in the shared demo persisted for every visitor because
// the money/investing endpoints had never been added to the list (it predated
// investing being clickable in the demo). This test locks in that the
// dangerous, persisting endpoints stay blocked, that the intentional money-flow
// MOCKS and reads stay live (so the demo still feels real), and that non-demo
// users are never affected. It is a black-box test of the middleware behavior,
// so a broken regex or a removed pattern fails here.
//
// Pure unit test — no DB, no server. blockDemoMutations only reads
// req.user/req.path/req.method; it never queries the DB (pg connects lazily).
//
// Run: `npx tsx script/test-demo-block.ts`  or  `npm run test:demo-block`

import assert from "node:assert/strict";
import "../server/env";
import { blockDemoMutations } from "../server/demoSandbox";

type Outcome = { blocked: boolean; status?: number; body?: any; nextCalled: boolean };

function run(method: string, path: string, isDemo: boolean): Outcome {
  const out: Outcome = { blocked: false, nextCalled: false };
  const req: any = { method, path, user: isDemo ? { isDemoAccount: true } : { isDemoAccount: false } };
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(body: any) { out.blocked = true; out.body = body; return res; },
  };
  const next = () => { out.nextCalled = true; };
  blockDemoMutations(req, res, next);
  return out;
}

function assertBlocked(method: string, path: string) {
  const o = run(method, path, true);
  assert.equal(o.blocked, true, `DEMO ${method} ${path} should be BLOCKED but passed through`);
  assert.equal(o.nextCalled, false, `DEMO ${method} ${path} called next() — it must not reach the handler`);
  assert.equal(o.status, 200, `DEMO ${method} ${path} should respond 200 (benign no-op), got ${o.status}`);
  assert.equal(o.body?.saved, false, `DEMO ${method} ${path} response must carry saved:false`);
  assert.equal(o.body?.demo, true, `DEMO ${method} ${path} response must carry demo:true`);
}

function assertPassesForDemo(method: string, path: string) {
  const o = run(method, path, true);
  assert.equal(o.nextCalled, true, `DEMO ${method} ${path} should PASS THROUGH (mock/read/auth) but was blocked`);
  assert.equal(o.blocked, false, `DEMO ${method} ${path} was blocked but should reach its handler`);
}

// 1) Persisting / dangerous endpoints a logged-in demo visitor can reach MUST be blocked.
//    (Includes the exact bug — holdings/sell — and the POST-not-DELETE fund delete.)
const MUST_BLOCK: Array<[string, string]> = [
  ["POST", "/api/holdings/sell"],
  ["POST", "/api/funds/abc123/liquidate"],
  ["POST", "/api/funds/abc123/auto-invest"],
  ["POST", "/api/withdrawals"],
  ["POST", "/api/funds"],
  ["POST", "/api/funds/abc123/close"],
  ["POST", "/api/funds/abc123/delete"],   // POST, not DELETE — blanket hard-write block misses it
  ["POST", "/api/funds/abc123/reopen"],
  ["POST", "/api/gifts/g123/claim"],
  ["POST", "/api/funds/abc123/recipient-ssn"],
  ["POST", "/api/funds/abc123/parent-contributions"],
  ["POST", "/api/funds/abc123/reconcile-stripe-gifts"],
  ["POST", "/api/funds/abc123/large-gift-holds/g9/release"],
  ["POST", "/api/kyc/submit"],
  ["POST", "/api/invitations/tok123/accept"],
  ["POST", "/api/invitations/tok123/decline"],
  ["POST", "/api/me/trusted-devices"],
  ["POST", "/api/subscription/cancel"],
  ["POST", "/api/monetization/triggers"],
  ["POST", "/api/user/change-password"],
  ["POST", "/api/account/delete"],
  ["POST", "/api/plaid/link-token"],
  ["POST", "/api/bank-accounts"],
  // Blanket hard-write block (any PATCH/PUT/DELETE under /api).
  ["PATCH", "/api/funds/abc123"],
  ["PUT", "/api/funds/abc123/something"],
  ["DELETE", "/api/funds/abc123"],
];

// 2) Endpoints the demo INTENTIONALLY lets through so the flow feels live, plus
//    auth, reads-via-POST, and GETs. Blocking any of these would break the demo.
const MUST_PASS: Array<[string, string]> = [
  ["POST", "/api/auth/login"],
  ["POST", "/api/auth/register"],
  ["POST", "/api/stripe/checkout/gift"],          // demo mock checkout
  ["POST", "/api/stripe/checkout/family-plan"],   // demo mock checkout
  ["POST", "/api/subscription/sync-stripe"],      // POST-as-read, idempotent refresh
  ["POST", "/api/stripe/calculate-fees"],         // read-via-POST
  ["GET", "/api/funds/abc123"],                   // GETs are never blocked
  ["GET", "/api/holdings/sell"],                  // GET on a blocked path is still a read
];

let failures = 0;
function guard(fn: () => void, label: string) {
  try { fn(); } catch (e) { failures++; console.error(`  FAIL: ${label}\n    ${(e as Error).message}`); }
}

console.log("demo-block regression test");
for (const [m, p] of MUST_BLOCK) guard(() => assertBlocked(m, p), `block ${m} ${p}`);
for (const [m, p] of MUST_PASS) guard(() => assertPassesForDemo(m, p), `pass ${m} ${p}`);

// 3) Non-demo users are NEVER affected: even the most dangerous path passes.
guard(() => {
  const o = run("POST", "/api/account/delete", false);
  assert.equal(o.nextCalled, true, "non-demo POST /api/account/delete must reach its handler");
  assert.equal(o.blocked, false, "non-demo user must never be blocked by the demo sandbox");
}, "non-demo user is unaffected");

if (failures > 0) {
  console.error(`\n${failures} demo-block assertion(s) failed. A persisting endpoint may be unguarded in the shared demo.`);
  process.exit(1);
}
console.log("All demo-block assertions passed.");
process.exit(0);
