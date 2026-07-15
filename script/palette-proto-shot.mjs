/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
const file = pathToFileURL(path.join(process.cwd(), "script", "palette-proto.html")).href;
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1180, height: 640 }, deviceScaleFactor: 2 })).newPage();
await p.goto(file, { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(1400);
await p.screenshot({ path: path.join(out, "palette-proto.png"), fullPage: true });
console.log("-> artifacts/dash/palette-proto.png");
await b.close();

