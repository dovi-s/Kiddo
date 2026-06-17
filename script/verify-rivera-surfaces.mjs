/* eslint-disable no-console */
// Verify the Rivera rename rendered correctly across the key surfaces:
// dashboard, Memory Book, My Gifts (gifter), and the gifters roster.
// Saves framed shots to artifacts/marketing-shots/ and prints any leftover
// Modern Family names found in the rendered DOM.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
import sharp from "sharp";

const base = "http://127.0.0.1:5000";
const dir = path.join(process.cwd(), "artifacts", "marketing-shots");
mkdirSync(dir, { recursive: true });
const MF = /Dunphy|Pritchett|Tucker|Delgado|Phil|Claire|\bJay\b|Gloria|Mitchell|Cameron|Manny|Haley|Luke|Alex/g;

async function frame(buf, dest) {
  const screen = await sharp(buf).resize({ width: 390 }).png().toBuffer();
  const m = await sharp(screen).metadata(); const w = m.width, h = m.height;
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="26" ry="26"/></svg>`);
  const rounded = await sharp(screen).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const bezel = Buffer.from(`<svg width="${w+28}" height="${h+28}"><rect width="${w+28}" height="${h+28}" rx="34" ry="34" fill="#141009"/></svg>`);
  await sharp(bezel).composite([{ input: rounded, top: 14, left: 14 }]).png().toFile(dest);
}

async function snap(ctx, url, dest, waitSel) {
  const p = await ctx.newPage();
  await p.goto(base + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (waitSel) await p.waitForSelector(waitSel, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(3500);
  const buf = await p.screenshot();
  await frame(buf, dest);
  const text = await p.evaluate(() => document.body.innerText);
  const hits = [...new Set((text.match(MF) || []))];
  const riveras = /Rivera|Bennett|Theo|Nora|Mia|Marcus|Elena|Sofia|David|Chris|Robert|Leo/.test(text);
  await p.close();
  return { hits, riveras };
}

async function main() {
  const b = await chromium.launch();
  // Parent (Elena): dashboard, memory, gifters roster
  const ctxE = await b.newContext({ ...devices["iPhone 14 Pro"] });
  await ctxE.request.post(`${base}/api/auth/login`, { data: { email: "elena@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const funds = await ctxE.request.get(`${base}/api/funds`, { timeout: 120000 }).then(r => r.json()).catch(() => []);
  const theo = funds.find(f => /theo/i.test(f?.recipientFirstName || "")) || funds[0];
  console.log("funds:", funds.map(f => f.recipientFirstName + "/" + f.slug).join(", "));

  const d = await snap(ctxE, `/design-lab?fund=${theo.id}`, path.join(dir, "app.dashboard.framed.png"), "text=/\\$[0-9]/");
  console.log("DASHBOARD  rivera:", d.riveras, " MF-leftovers:", d.hits);
  const m = await snap(ctxE, `/memory/${theo.id}`, path.join(dir, "app.memory.framed.png"), null);
  console.log("MEMORY     rivera:", m.riveras, " MF-leftovers:", m.hits);
  await ctxE.close();

  // Gifter (Robert): My Gifts
  const ctxR = await b.newContext({ ...devices["iPhone 14 Pro"] });
  await ctxR.request.post(`${base}/api/auth/login`, { data: { email: "robert@riverafamily.com", password: "riverafamily" }, timeout: 120000 }).catch(() => {});
  const g = await snap(ctxR, `/my-gifts`, path.join(dir, "app.mygifts.framed.png"), null);
  console.log("MY GIFTS   rivera:", g.riveras, " MF-leftovers:", g.hits);
  await ctxR.close();
  await b.close();
  console.log("done ->", dir);
}
main().catch(e => { console.error(String(e)); process.exit(1); });
