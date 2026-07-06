/* eslint-disable no-console */
// Render-verify the recurring-config-burst collapse: log in as the Rivera demo,
// set Theo as the active fund, INTERCEPT /api/activities and splice in a
// consecutive burst of 4 "Recurring investment updated/cancelled/started" rows
// (the demo seed has none), then screenshot the feed collapsed + expanded.
// No data is mutated — the injection lives only in the intercepted response.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

const EMAIL = "elena@riverafamily.com";
const PASSWORD = "riverafamily";
const THEO = "5c90c61f-ad56-4328-ac48-55d9a5c9798c";

// A believable dial-in burst over two adjacent days, newest-first.
function burstRows(fundId) {
  const mk = (id, title, type, description, amount, createdAt) => ({
    id, fundId, type, title, description, amount: String(amount), createdAt,
    metadata: JSON.stringify({ amount, frequency: "month", selectedTicker: (description.match(/into (\w+)/) || [])[1] || null }),
  });
  return [
    mk("burst-4", "Recurring investment cancelled", "recurring_cancelled", "$100/year into AAPL", 100, "2026-07-03T14:05:00.000Z"),
    mk("burst-3", "Recurring investment updated", "recurring_updated", "$25/month into DUOL", 25, "2026-07-03T10:40:00.000Z"),
    mk("burst-2", "Recurring investment updated", "recurring_updated", "$100/week into GOOGL", 100, "2026-07-02T16:20:00.000Z"),
    mk("burst-1", "Recurring investment started", "recurring_created", "$25/month into AAPL", 25, "2026-07-02T09:15:00.000Z"),
  ];
}

async function run(ctx, label) {
  const p = await ctx.newPage();
  await p.addInitScript((theo) => {
    sessionStorage.setItem("kora-launched", "1");
    localStorage.setItem("kiddo_active_fund_id", theo);
  }, THEO);

  // Splice the burst into the top of the activities payload.
  await p.route(/\/api\/activities/, async (route) => {
    const resp = await route.fetch();
    let rows;
    try { rows = await resp.json(); } catch { return route.fulfill({ response: resp }); }
    if (!Array.isArray(rows)) return route.fulfill({ response: resp });
    const fundId = (rows[0] && rows[0].fundId) || THEO;
    const merged = [...burstRows(fundId), ...rows];
    return route.fulfill({ response: resp, body: JSON.stringify(merged), headers: { "content-type": "application/json" } });
  });

  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push("JS:" + m.text().slice(0, 90)); });

  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill(EMAIL);
  await p.getByTestId("input-login-password").fill(PASSWORD);
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.goto(base + "/activity", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(4000);

  // Collapsed state.
  const runLoc = p.locator('[data-testid^="activity-recurring-config-run-"]');
  const found = await runLoc.count();
  console.log(`  ${label}: config-run rows found = ${found}`);
  if (found > 0) {
    await runLoc.first().scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    await runLoc.first().screenshot({ path: path.join(out, `configrun.${label}.collapsed.png`) }).catch(() => {});
    // Expand.
    await runLoc.first().getByText(/Show all/i).click().catch(async () => { await runLoc.first().click(); });
    await p.waitForTimeout(500);
    await runLoc.first().screenshot({ path: path.join(out, `configrun.${label}.expanded.png`) }).catch(() => {});
  }
  // Whole-feed context shot regardless.
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(out, `configrun.${label}.feed.png`), fullPage: true });
  if (errs.length) console.log(`  ! ${label}: ${[...new Set(errs)].slice(0, 6).join(" | ")}`);
  await p.close();
  return found;
}

async function main() {
  const b = await chromium.launch();
  const mob = await b.newContext({ ...devices["iPhone 14 Pro"] });
  const n = await run(mob, "mobile");
  await b.close();
  console.log(`-> artifacts/dash  (found ${n} collapsed config-run row(s))`);
  if (!n) process.exitCode = 2;
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
