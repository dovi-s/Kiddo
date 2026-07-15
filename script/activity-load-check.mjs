/* eslint-disable no-console */
// Load /activity as the Rivera demo and report JS console errors — verifies the
// new RecurringEditSheet import + always-mounted <RecurringEditSheet open={false}/>
// don't crash the page at runtime (tsc can't catch a bad hook order / null deref).
import { chromium, devices } from "playwright";
import path from "node:path";
import { mkdirSync } from "node:fs";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 });
const errs = [];

const lp = await ctx.newPage();
await lp.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await lp.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
await lp.getByTestId("input-login-email").fill("elena@riverafamily.com");
await lp.getByTestId("input-login-password").fill("riverafamily");
await lp.getByTestId("button-login").click();
await lp.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
await lp.close();

const p = await ctx.newPage();
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
p.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 140)));
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto(base + "/activity", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(6000);
// Reach the Schedules tab (where the stat band + Edit/Pause live).
await p.getByText(/^schedules$/i).first().click().catch(() => {});
await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(out, "activity-load-check.png"), fullPage: true });
const hasContent = await p.locator("[data-testid='page-activity']").count();
console.log("page-activity present:", hasContent);
console.log(errs.length ? "JS ERRORS:\n" + [...new Set(errs)].slice(0, 8).join("\n") : "no JS errors");
await b.close();
