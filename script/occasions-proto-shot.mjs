import path from "node:path";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
const file = pathToFileURL(path.join(process.cwd(), "script", "occasions-proto.html")).href;
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 820, height: 320 }, deviceScaleFactor: 2 })).newPage();
await p.goto(file, { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(1200);
await p.screenshot({ path: path.join(out, "occasions-proto.png"), fullPage: true });
console.log("-> artifacts/dash/occasions-proto.png");
await b.close();

