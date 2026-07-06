/* eslint-disable no-console */
// Render /partners (mobile + desktop) to verify the new persisted inquiry form
// replaces the old mailto and lays out cleanly. Public page, no auth.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const errs = [];

const mob = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
mob.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 90)); });
await mob.goto(base + "/partners", { waitUntil: "networkidle", timeout: 60000 });
await mob.waitForTimeout(1200);
// Scroll the inquiry form into view for the shot.
await mob.evaluate(() => document.getElementById("partner-inquiry")?.scrollIntoView());
await mob.waitForTimeout(500);
await mob.screenshot({ path: path.join(out, "partners.mobile.png"), fullPage: true });
console.log("-> partners.mobile.png");

const desk = await (await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
await desk.goto(base + "/partners", { waitUntil: "networkidle", timeout: 60000 });
await desk.evaluate(() => document.getElementById("partner-inquiry")?.scrollIntoView());
await desk.waitForTimeout(600);
await desk.screenshot({ path: path.join(out, "partners.desktop.png"), fullPage: true });
console.log("-> partners.desktop.png");

await b.close();
console.log(errs.length ? "JS errors: " + [...new Set(errs)].slice(0, 6).join(" | ") : "no JS errors");
