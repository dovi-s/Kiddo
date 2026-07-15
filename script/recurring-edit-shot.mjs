import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];
console.log("fund:", fund);

const me = await p.evaluate(() => fetch("/api/auth/user", { credentials: "include" }).then((r) => r.json()).catch(() => null));
const userId = String(me?.id || me?.user?.id || "");
console.log("userId:", userId);

// Seed a demo recurring so an editable schedule exists, then reload.
await p.evaluate(({ fund, userId }) => {
  const entry = { fundId: fund, userId, amount: "100", frequency: "monthly", executionModel: "auto", selectedTicker: null, createdAt: new Date(Date.now() - 3600e3).toISOString() };
  sessionStorage.setItem("kiddo.demo.recurring.v1", JSON.stringify([entry]));
}, { fund, userId });

await p.goto(base + "/staging?fund=" + fund, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(13000);

const dbg = await p.evaluate(() => ({
  seed: sessionStorage.getItem("kiddo.demo.recurring.v1"),
  rows: document.querySelectorAll('[data-testid^="recurring-list-row-"]').length,
  listView: !!document.querySelector('[data-testid="recurring-list-view"]'),
  readonly: !!document.querySelector('[data-testid="recurring-readonly"]'),
  chip: !!document.querySelector('[data-testid="chip-recurring-status"]'),
}));
console.log("DEBUG:", JSON.stringify(dbg));

// The recurring summary renders as a collapsed chip; tap it to reveal the rows.
const chip = p.getByTestId("chip-recurring-status").first();
await chip.scrollIntoViewIfNeeded().catch(() => {});
await chip.click().catch(() => console.log("no chip click"));
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(out, "recurring-edit-fullpage.png"), fullPage: true });

// Open the recurring schedule's action sheet → Edit.
const row = p.locator('[data-testid^="recurring-list-row-"]').first();
await row.scrollIntoViewIfNeeded().catch(() => {});
await row.waitFor({ state: "visible", timeout: 15000 }).catch(() => console.log("no recurring row"));
await row.click().catch(() => {});
await p.waitForTimeout(800);
await p.getByTestId("list-action-edit").click().catch(() => console.log("no edit action"));
await p.waitForTimeout(2000);

const dlg = p.locator('[role="dialog"]').first();
if (await dlg.count()) {
  await dlg.screenshot({ path: path.join(out, "recurring-edit-amount.png") });
  console.log("-> recurring-edit-amount.png");

  // Untouched: primary CTA should read "No changes yet" (disabled). Scroll to it.
  const saveBtn = p.getByTestId("button-save-auto-invest-amount");
  await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(400);
  await dlg.screenshot({ path: path.join(out, "recurring-edit-save-nochanges.png") });
  console.log("-> recurring-edit-save-nochanges.png");

  // Dirty it: change the amount → CTA should enable and read "Save changes".
  const amtInput = p.getByTestId("input-auto-invest-amount");
  await amtInput.fill("150").catch(() => console.log("no amount input"));
  await p.waitForTimeout(700);
  await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(300);
  await dlg.screenshot({ path: path.join(out, "recurring-edit-save-dirty.png") });
  console.log("-> recurring-edit-save-dirty.png");
  // reset the amount so the Change nav check below is clean
  await amtInput.fill("100").catch(() => {});
  await p.waitForTimeout(300);

  // Now click "Change" and confirm it lands on the destination step.
  await p.getByTestId("button-recurring-change-destination").click().catch(() => console.log("no change button"));
  await p.waitForTimeout(1200);
  await dlg.screenshot({ path: path.join(out, "recurring-edit-change-target.png") });
  console.log("-> recurring-edit-change-target.png");
} else {
  console.log("no dialog found");
}
await b.close();
