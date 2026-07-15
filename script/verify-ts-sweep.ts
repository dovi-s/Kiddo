/* eslint-disable no-console */
// Runtime verification of the T&S sweep (commit cd5c522) against a live dev
// server: drives the REAL endpoints and asserts the gate behaviors —
// H2/H9 (name/message rules on all public text paths), H6/H7 (blocklist on
// every gift path), H8 (checkout velocity), H4 (kid-view PIN lockout,
// durable + token-keyed). One-off harness, reusable; assumes `npm run dev`
// healthy on :5000 + the Rivera seed. Creates its own throwaway parent+fund
// (NON-demo, so validation paths actually execute) and cleans up its
// blocklist row + rate-limit keys at the end.
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const TEST_EMAIL = "ts-sweep-qa@example.com";
const BLOCKED_EMAIL = "ts-sweep-blocked@example.com";

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass += 1; console.log(`PASS  ${m}`); };
const bad = (m: string) => { fail += 1; console.error(`FAIL  ${m}`); };

async function post(path: string, body: any, cookie?: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  // ── Setup: throwaway parent + NON-demo fund (validation runs before the
  // demo short-circuit only on some paths; a real fund exercises all). ──
  const email = `ts-sweep-parent-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = "TsSweep123!";
  let cookie = "";
  {
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, firstName: "TS", lastName: "Sweep" }),
    });
    if (reg.status !== 200 && reg.status !== 201) throw new Error(`register failed: ${reg.status} ${await reg.text()}`);
    cookie = String(reg.headers.get("set-cookie") || "").split(";")[0];
  }
  let fundId = "";
  {
    // Same fixture shape as ui-smoke-playwright.ts (incl. the per-fund UTMA
    // acknowledgment that gates non-draft creation).
    const res = await fetch(`${baseUrl}/api/funds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        name: "TS Sweep QA Fund",
        slug: `ts-sweep-${Math.floor(Math.random() * 1e9)}`,
        accountType: "UTMA",
        status: "active",
        utmaAcknowledgedAt: new Date().toISOString(),
        recipientFirstName: "Testkid",
        recipientRelation: "parent",
        investmentStrategy: "auto_invest",
        isDiscoverable: false,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    fundId = String(json?.id || json?.fund?.id || "");
    if (!fundId) throw new Error(`fund create failed: ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  }
  // The server keeps client-created funds as 'draft'; the guestbook path
  // requires 'active'. Test fixture, so set it directly.
  await db.execute(sql`UPDATE funds SET status = 'active' WHERE id = ${fundId}`);
  console.log(`setup: fund ${fundId}\n`);

  const giftBase = { fundId, amount: 25, senderEmail: TEST_EMAIL, senderName: "Grandma QA", coverFees: true, paymentMethod: "card", executionModel: "auto" };

  // ── H2/H9 — one-time checkout ──
  {
    const r1 = await post("/api/stripe/checkout/gift", { ...giftBase, message: "claim your gift at bit.ly/abc123" });
    r1.status === 400 && /link/i.test(r1.json?.error || "") ? ok("one-time: shortener in message → 400") : bad(`one-time message: ${r1.status} ${JSON.stringify(r1.json).slice(0, 120)}`);
    const r2 = await post("/api/stripe/checkout/gift", { ...giftBase, senderName: "call 555-123-4567" });
    r2.status === 400 ? ok("one-time: phone in name → 400") : bad(`one-time name: ${r2.status}`);
  }

  // ── H2/H9 — recurring checkout ──
  {
    const recBase = { ...giftBase, recurringFrequency: "monthly", accountPassword: "Password123!" };
    const r1 = await post("/api/stripe/checkout/gift-recurring", { ...recBase, message: "email me at uncle@example.com" });
    r1.status === 400 ? ok("recurring: contact info in message → 400") : bad(`recurring message: ${r1.status} ${JSON.stringify(r1.json).slice(0, 120)}`);
    const r2 = await post("/api/stripe/checkout/gift-recurring", { ...recBase, senderName: "Kiddo Support" });
    r2.status === 400 ? ok("recurring: brand-impersonation name → 400") : bad(`recurring name: ${r2.status}`);
  }

  // ── H2/H9 — gift-intents ──
  {
    const r = await post("/api/gift-intents", {
      gifterName: "Cool Uncle", gifterEmail: TEST_EMAIL, recipientEmail: "someparent@example.com",
      kidFirstName: "Kid", amount: 25, message: "go to www.free-money.example",
    });
    r.status === 400 ? ok("gift-intents: link in message → 400") : bad(`gift-intents message: ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }

  // ── H2/H9 — guestbook ──
  {
    const r = await post(`/api/public/funds/${fundId}/guestbook-note`, { name: "Neighbor", note: "text me at (212) 555-0199 ok" });
    r.status === 400 ? ok("guestbook: phone in note → 400") : bad(`guestbook note: ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }

  // ── H6/H7 — blocklist on every path ──
  await db.execute(sql`
    INSERT INTO blocked_gifters (email, scope, reason)
    VALUES (${BLOCKED_EMAIL}, 'global', 'ts-sweep runtime verification')
    ON CONFLICT DO NOTHING
  `);
  {
    const r1 = await post("/api/stripe/checkout/gift", { ...giftBase, senderEmail: BLOCKED_EMAIL, message: "" });
    r1.status === 403 ? ok("one-time: blocked sender → 403") : bad(`one-time blocklist: ${r1.status}`);
    const r2 = await post("/api/stripe/checkout/gift-recurring", { ...giftBase, senderEmail: BLOCKED_EMAIL, recurringFrequency: "monthly", accountPassword: "Password123!" });
    r2.status === 403 ? ok("recurring: blocked sender → 403") : bad(`recurring blocklist: ${r2.status}`);
    const r3 = await post("/api/gift-intents", { gifterName: "Blocked Person", gifterEmail: BLOCKED_EMAIL, recipientEmail: "p@example.com", kidFirstName: "Kid", amount: 25 });
    r3.status === 403 ? ok("gift-intents: blocked sender → 403") : bad(`gift-intents blocklist: ${r3.status}`);
    const r4 = await post(`/api/public/funds/${fundId}/guestbook-note`, { name: "Blocked Person", note: "hello there friend", email: BLOCKED_EMAIL });
    r4.status === 403 ? ok("guestbook: blocked sender → 403") : bad(`guestbook blocklist: ${r4.status}`);
  }

  // ── H8 — checkout velocity (10/hr per email). Use a dedicated email so the
  // attempts above don't pollute the count; expect allowance to run out. ──
  {
    const velEmail = `ts-sweep-velocity-${Math.floor(Math.random() * 1e9)}@example.com`;
    let got429 = false;
    let firstStatuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const r = await post("/api/stripe/checkout/gift", { ...giftBase, senderEmail: velEmail, message: "" });
      if (i < 2) firstStatuses.push(r.status);
      if (r.status === 429) { got429 = true; break; }
    }
    got429 ? ok(`velocity: hit 429 within 12 attempts (early statuses: ${firstStatuses.join(",")})`) : bad("velocity: 12 checkout attempts never hit 429");
    await db.execute(sql`DELETE FROM rate_limit_counters WHERE key LIKE ${"gift-velocity:" + velEmail + "%"}`);
  }

  // ── H4 — kid-view PIN lockout (durable, token-keyed, failures-only).
  // Create the kid view through the REAL settings endpoint on our fixture
  // fund (the store is the .local JSON file, not Postgres). ──
  {
    const kvRes = await fetch(`${baseUrl}/api/funds/${fundId}/kid-view-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ enabled: true, pin: "4321" }),
    });
    const kvJson: any = await kvRes.json().catch(() => ({}));
    const shareLink = String(kvJson?.shareLink || "");
    const token = shareLink.split("/kid/")[1] || "";
    if (!token) {
      bad(`H4 setup: could not create kid view (${kvRes.status} ${JSON.stringify(kvJson).slice(0, 120)})`);
    } else {
      await db.execute(sql`DELETE FROM rate_limit_counters WHERE key = ${"kidview-pin:" + token}`);
      // 2 wrong tries then the RIGHT pin — must succeed (failures-only counting)...
      await post(`/api/kid-view/${token}/unlock`, { pin: "0000" });
      await post(`/api/kid-view/${token}/unlock`, { pin: "1111" });
      const good = await post(`/api/kid-view/${token}/unlock`, { pin: "4321" });
      good.status === 200 && good.json?.accessToken
        ? ok("kid-view PIN: correct PIN succeeds after 2 failures (failures-only counting)")
        : bad(`kid-view PIN: correct PIN blocked after 2 failures: ${good.status}`);
      // ...and the success RESET the window, so 5 fresh failures are needed to lock:
      let saw429 = false;
      for (let i = 0; i < 7; i += 1) {
        const r = await post(`/api/kid-view/${token}/unlock`, { pin: "0000" });
        if (r.status === 429) { saw429 = i >= 5; break; }
        if (r.status !== 401) { bad(`H4: unexpected status ${r.status} on wrong PIN`); break; }
      }
      saw429 ? ok("kid-view PIN: 5 wrong tries after reset → durable 429 lockout") : bad("kid-view PIN: lockout did not engage as expected");
      // Locked means even the CORRECT pin is refused until the window expires:
      const lockedGood = await post(`/api/kid-view/${token}/unlock`, { pin: "4321" });
      lockedGood.status === 429 ? ok("kid-view PIN: lockout holds even for the correct PIN") : bad(`kid-view PIN: lockout bypassed by correct PIN: ${lockedGood.status}`);
      await db.execute(sql`DELETE FROM rate_limit_counters WHERE key = ${"kidview-pin:" + token}`);
    }
  }

  // ── Control: a legitimate warm gift still passes validation (reaches the
  // Stripe-session stage rather than a policy 400/403/429). ──
  {
    const r = await post("/api/stripe/checkout/gift", { ...giftBase, senderEmail: "grandma-legit@example.com", message: "para tu futuro mi vida. besos" });
    // Success = a Stripe URL (200) or a Stripe-side config error — anything
    // EXCEPT our policy gates.
    const policyBlocked = r.status === 400 || r.status === 403 || r.status === 429;
    !policyBlocked ? ok(`control: warm legit gift passes policy gates (status ${r.status})`) : bad(`control gift blocked by policy: ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  }

  // ── Cleanup ──
  await db.execute(sql`DELETE FROM blocked_gifters WHERE email = ${BLOCKED_EMAIL} AND reason = 'ts-sweep runtime verification'`);
  await db.execute(sql`DELETE FROM rate_limit_counters WHERE key LIKE 'gift-velocity:ts-sweep%'`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("VERIFY SCRIPT ERROR:", err); process.exit(1); });
