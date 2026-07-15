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
try { await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
catch { await p.reload({ waitUntil: "domcontentloaded" }); await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];

await p.goto(base + "/memory/" + fund, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);

const bar = p.locator('[data-testid="memory-primary-filter-bar"]').first();
await bar.scrollIntoViewIfNeeded().catch(() => console.log("no filter bar"));
await p.waitForTimeout(600);
// Capture the toolbar + a couple entries below it.
const box = await bar.boundingBox().catch(() => null);
const y = box ? Math.max(0, box.y - 20) : 200;
await p.screenshot({ path: path.join(out, "memory-toolbar.png"), clip: { x: 0, y, width: 393, height: 400 } });
console.log("-> memory-toolbar.png (y=" + Math.round(y) + ")");

// Open "More filters" to confirm the year picker landed there.
await p.getByTestId("button-memory-more-filters").click().catch(() => console.log("no more-filters btn"));
await p.waitForTimeout(700);
const y2 = box ? Math.max(0, box.y - 20) : 200;
await p.screenshot({ path: path.join(out, "memory-toolbar-open.png"), clip: { x: 0, y: y2, width: 393, height: 470 } });
console.log("-> memory-toolbar-open.png");
await b.close();
