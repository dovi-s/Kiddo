/* eslint-disable no-console */
// High-DPI capture of the hero TOP + right edge to inspect for a full-bleed sliver.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
await p.waitForURL(/fund=/i, { timeout: 15000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];
await p.goto(base + "/staging" + (fund ? `?fund=${fund}` : ""), { waitUntil: "domcontentloaded" });
await p.locator('[data-testid="hero-card"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3500);
// Full top of page incl. both edges.
await p.screenshot({ path: path.join(out, "hero-edge-desktop.png"), clip: { x: 0, y: 0, width: 1440, height: 300 } });
// Tight crop of the RIGHT edge (last 60px) — look for a cream sliver.
await p.screenshot({ path: path.join(out, "hero-rightedge-desktop.png"), clip: { x: 1380, y: 0, width: 60, height: 300 } });
console.log("-> hero-edge.png + hero-rightedge.png");
await b.close();
