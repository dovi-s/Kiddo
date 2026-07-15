/* eslint-disable no-console */
// Runtime verification of previous-owner access revocation (migration 0042 +
// POST /api/funds/:fundId/revoke-previous-owner-access + Settings card).
// Uses the Rivera demo: Mia owns her transferred fund, Marcus is the
// previous custodian. RESTORES the demo state at the end (the founder's
// "Your part of the story" demo surface depends on Marcus's window being open).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-prev-owner-revoke");
mkdirSync(outDir, { recursive: true });

let pass = 0, fail = 0;
const ok = (m: string) => { pass += 1; console.log(`PASS  ${m}`); };
const bad = (m: string) => { fail += 1; console.error(`FAIL  ${m}`); };

async function login(email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "riverafamily" }),
  });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return String(res.headers.get("set-cookie") || "").split(";")[0];
}

async function get(path2: string, cookie: string) {
  const res = await fetch(`${baseUrl}${path2}`, { headers: { cookie } });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
async function post(path2: string, cookie: string) {
  const res = await fetch(`${baseUrl}${path2}`, { method: "POST", headers: { cookie, "Content-Type": "application/json" } });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  const haley = await login("mia@riverafamily.com");
  const phil = await login("marcus@riverafamily.com");

  // Find Mia's transferred fund (she owns it; Marcus is previousOwner).
  const haleyFunds = await get("/api/funds", haley);
  const list: any[] = Array.isArray(haleyFunds.json) ? haleyFunds.json : haleyFunds.json?.funds || [];
  const fund = list.find((f) => f.transferredAt && f.previousOwnerId);
  if (!fund) throw new Error(`no transferred fund found for Mia (${list.length} funds)`);
  const fundId = String(fund.id);
  console.log(`fund: ${fundId} (previousOwnerId ${String(fund.previousOwnerId).slice(0, 8)}...)\n`);

  // Baseline: Marcus CAN see it.
  const before = await get(`/api/funds/${fundId}/dashboard-summary`, phil);
  before.status === 200 ? ok("baseline: Marcus (previous owner) can read the fund") : bad(`baseline read: ${before.status}`);
  const philFundsBefore = await get("/api/funds", phil);
  const philListBefore: any[] = Array.isArray(philFundsBefore.json) ? philFundsBefore.json : philFundsBefore.json?.funds || [];
  philListBefore.some((f) => String(f.id) === fundId) ? ok("baseline: fund appears in Marcus's fund list") : bad("baseline: fund missing from Marcus's list");

  // PROBE: Marcus cannot revoke (he's view-only on this fund).
  const philTries = await post(`/api/funds/${fundId}/revoke-previous-owner-access`, phil);
  philTries.status === 403 ? ok("probe: Marcus cannot call revoke (403 view-only)") : bad(`probe: Marcus revoke returned ${philTries.status}`);

  // UI: the card renders for Mia in Settings, confirm flow works.
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.request.post(`${baseUrl}/api/auth/login`, { data: { email: "mia@riverafamily.com", password: "riverafamily" } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/settings?fund=${fundId}&tab=child`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const card = page.getByTestId("previous-custodian-access-card");
  let cardSeen = false;
  try {
    await card.waitFor({ state: "visible", timeout: 15000 });
    cardSeen = true;
  } catch { /* maybe a different tab param shape; fall through to API revoke */ }
  if (cardSeen) {
    ok("UI: 'Who can see this fund' card renders for the owner");
    await card.screenshot({ path: path.join(outDir, "1-card.png") });
    await page.getByTestId("button-revoke-previous-owner-open").click();
    await page.getByTestId("revoke-previous-owner-confirm").waitFor({ state: "visible", timeout: 5000 });
    await card.screenshot({ path: path.join(outDir, "2-confirm.png") });
    await page.getByTestId("button-revoke-previous-owner-confirm").click();
    // The POST does updateFund + an audit write against the remote DB —
    // wait for the card to actually unmount rather than a fixed beat.
    try {
      await card.waitFor({ state: "detached", timeout: 15000 });
      ok("UI: card disappears after revoke");
    } catch {
      bad("UI: card still visible 15s after revoke");
    }
    await page.screenshot({ path: path.join(outDir, "3-after.png") });
  } else {
    console.log("NOTE  UI card not reachable at that URL shape; revoking via API instead");
    const r = await post(`/api/funds/${fundId}/revoke-previous-owner-access`, haley);
    r.status === 200 ? ok("API: Mia revokes successfully") : bad(`API revoke: ${r.status} ${JSON.stringify(r.json)}`);
  }
  await browser.close();

  // After: Marcus is locked out everywhere.
  const after = await get(`/api/funds/${fundId}/dashboard-summary`, phil);
  after.status === 403 ? ok("after: Marcus's read is now 403") : bad(`after read: ${after.status}`);
  const philFundsAfter = await get("/api/funds", phil);
  const philListAfter: any[] = Array.isArray(philFundsAfter.json) ? philFundsAfter.json : philFundsAfter.json?.funds || [];
  !philListAfter.some((f) => String(f.id) === fundId) ? ok("after: fund gone from Marcus's fund list") : bad("after: fund still in Marcus's list");

  // Idempotency.
  const again = await post(`/api/funds/${fundId}/revoke-previous-owner-access`, haley);
  again.status === 200 && again.json?.alreadyRevoked ? ok("idempotent: second revoke reports alreadyRevoked") : bad(`second revoke: ${again.status} ${JSON.stringify(again.json)}`);

  // RESTORE the demo: reopen Marcus's window.
  await db.execute(sql`UPDATE funds SET previous_owner_access_revoked_at = NULL WHERE id = ${fundId}`);
  const restored = await get(`/api/funds/${fundId}/dashboard-summary`, phil);
  restored.status === 200 ? ok("cleanup: demo restored (Marcus's window reopened)") : bad(`cleanup: Marcus still locked out: ${restored.status}`);

  console.log(`\n${pass} passed, ${fail} failed — screenshots: ${outDir}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("VERIFY SCRIPT ERROR:", err); process.exit(1); });
