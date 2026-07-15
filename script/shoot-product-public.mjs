/* eslint-disable no-console */
// Capture clean, retina, IP-safe (Rivera) product screens for the PUBLIC
// marketing site. Demo banner hidden; raw screens (no bezel — the marketing
// DeviceFrame component frames them in CSS). Output: client/public/product/.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "client", "public", "product");
mkdirSync(out, { recursive: true });
const HIDE_DEMO = `[data-testid="demo-banner"]{display:none !important}`;

async function shoot(ctx, url, name, waitSel) {
  const p = await ctx.newPage();
  await p.goto(base + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.addStyleTag({ content: HIDE_DEMO }).catch(() => {});
  if (waitSel) await p.waitForSelector(waitSel, { timeout: 22000 }).catch(() => {});
  await p.waitForTimeout(4200); // let rolls / charts / motion settle
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: path.join(out, `${name}.png`) }); // viewport-only
  console.log("shot", name);
  await p.close();
}

async function main() {
  const b = await chromium.launch();
  const vp = { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

  // Parent (Elena): dashboard, memory, kid view, age-18 handoff
  const e = await b.newContext({ viewport: vp, userAgent: "Mozilla/5.0 (iPhone) Mobile" });
  await e.request.post(`${base}/api/auth/login`, { data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const funds = await e.request.get(`${base}/api/funds`, { timeout: 120000 }).then(r => r.json()).catch(() => []);
  const theo = funds.find(f => /theo/i.test(f?.recipientFirstName || "")) || funds[0];
  const nora = funds.find(f => /nora/i.test(f?.recipientFirstName || "")) || funds[1] || theo;
  console.log("funds:", funds.map(f => f.recipientFirstName).join(", "));

  await shoot(e, `/design-lab?fund=${theo.id}`, "dashboard", "text=/\\$[0-9]/");
  await shoot(e, `/memory/${theo.id}`, "memory", "text=/Memory Book/i");
  await shoot(e, `/kid/${theo.id}`, "kidview", null);
  await shoot(e, `/age-18-plan?fund=${nora.id}`, "age18", null);
  await e.close();

  // Gifter (Robert): My Gifts
  const r = await b.newContext({ viewport: vp, userAgent: "Mozilla/5.0 (iPhone) Mobile" });
  await r.request.post(`${base}/api/auth/login`, { data: { email: "robert@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  await shoot(r, `/my-gifts`, "mygifts", "text=/Welcome back/i");
  await r.close();
  await b.close();
  console.log("done ->", out);
}
main().catch(e => { console.error(String(e)); process.exit(1); });
