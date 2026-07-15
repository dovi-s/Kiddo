/* eslint-disable no-console */
// Screenshot the full-bleed evergreen hero prototype (variants A + B) so the
// founder can judge the look. Pure static mock — no app, no WIP touched.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const file = pathToFileURL(path.join(process.cwd(), "script", "hero-proto.html")).href;
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1010, height: 980 }, deviceScaleFactor: 2 })).newPage();
await p.goto(file, { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(1400); // let webfonts settle
await p.screenshot({ path: path.join(out, "hero-proto.png"), fullPage: true });
console.log("-> artifacts/dash/hero-proto.png");
await b.close();
