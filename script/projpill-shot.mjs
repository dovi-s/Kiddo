import path from "node:path";import { mkdirSync } from "node:fs";import { pathToFileURL } from "node:url";import { chromium } from "playwright";
const file = pathToFileURL(path.join(process.cwd(),"script","projpill-proto.html")).href;
const out = path.join(process.cwd(),"artifacts","dash");mkdirSync(out,{recursive:true});
const b = await chromium.launch();const p = await (await b.newContext({viewport:{width:420,height:430},deviceScaleFactor:2})).newPage();
await p.goto(file,{waitUntil:"networkidle"});await p.waitForTimeout(900);
await p.screenshot({path:path.join(out,"projpill-proto.png"),fullPage:true});console.log("-> projpill-proto.png");await b.close();
