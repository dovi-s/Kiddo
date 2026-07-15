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
const me = await p.evaluate(() => fetch("/api/auth/user", { credentials: "include" }).then((r) => r.json()).catch(() => null));
const userId = String(me?.id || me?.user?.id || "");
console.log("fund:", fund, "userId:", userId);

// Seed a demo SBUX *pick* recurring so the Activity detail shows a picked-stock schedule.
const createdAt = new Date(Date.now() - 3600e3).toISOString();
const scheduleId = `demo-recurring-${fund}-${createdAt}`;
const model = process.env.SHOT_MODEL || "pick";
await p.evaluate(({ fund, userId, createdAt, model }) => {
  const entry = { fundId: fund, userId, amount: "25", frequency: "monthly", executionModel: model, selectedTicker: model === "pick" ? "SBUX" : null, createdAt };
  sessionStorage.setItem("kiddo.demo.recurring.v1", JSON.stringify([entry]));
}, { fund, userId, createdAt, model });

const detail = encodeURIComponent(`schedule:${scheduleId}`);
await p.goto(base + "/activity?fund=" + fund + "&tab=scheduled&detail=" + detail, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
const opened = await p.locator('[role="dialog"]').first().count();
console.log("dialog open:", opened);

await p.screenshot({ path: path.join(out, "activity-fullpage.png"), fullPage: true });
const dlg = p.locator('[role="dialog"]').first();
if (await dlg.count()) {
  const name = (process.env.SHOT_MODEL || "pick") === "pick" ? "activity-schedule-detail.png" : "activity-schedule-detail-managed.png";
  await dlg.screenshot({ path: path.join(out, name) });
  console.log("->", name);
}
await b.close();
