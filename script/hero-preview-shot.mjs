/* eslint-disable no-console */
// Render the REAL <HeroMoment> component at the temp public /hero-preview route
// (mobile + desktop) so the founder can judge variant C as live code.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

const b = await chromium.launch();

// Mobile
const mob = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
const errs = [];
mob.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 90)); });
await mob.goto(base + "/hero-preview", { waitUntil: "networkidle", timeout: 60000 });
await mob.waitForTimeout(1500);
await mob.screenshot({ path: path.join(out, "hero-preview.mobile.png") });
console.log("-> hero-preview.mobile.png");

// Desktop
const desk = await (await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
await desk.goto(base + "/hero-preview", { waitUntil: "networkidle", timeout: 60000 });
await desk.waitForTimeout(1200);
await desk.screenshot({ path: path.join(out, "hero-preview.desktop.png") });
console.log("-> hero-preview.desktop.png");

console.log(errs.length ? "JS errors: " + [...new Set(errs)].slice(0, 6).join(" | ") : "no JS errors");
await b.close();
