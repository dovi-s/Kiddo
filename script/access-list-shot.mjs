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

await p.goto(base + "/settings?fund=" + fund, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(7000);
const revoke = p.locator('[data-testid^="button-revoke-collab-"]').first();
await revoke.scrollIntoViewIfNeeded().catch(() => console.log("no revoke row"));
await p.waitForTimeout(600);
const box = await revoke.boundingBox().catch(() => null);
const y = box ? Math.max(0, box.y - 150) : 200;
await p.screenshot({ path: path.join(out, "access-list.png"), clip: { x: 0, y, width: 393, height: 340 } });
console.log("-> access-list.png (y=" + Math.round(y) + ")");
await b.close();
