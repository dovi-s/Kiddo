/* eslint-disable no-console */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

async function loadCheck(ctx, route, label) {
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 90)); });
  p.on("pageerror", (e) => errs.push("PAGEERR:" + String(e).slice(0, 90)));
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2500);
  console.log(`${label} (${route}): ${errs.length ? "ERRORS: " + [...new Set(errs)].slice(0,4).join(" | ") : "clean"}`);
  return p;
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
  // 1) GiveAGift mounts with the new scroll hook
  const g = await loadCheck(ctx, "/give-a-gift", "GiveAGift");
  await g.close();
  // 2) GetStarted (uses the calendar) — open the birthdate picker if present
  const gs = await loadCheck(ctx, "/get-started", "GetStarted");
  // try to surface a calendar: click any element that opens a date picker
  try {
    // advance any "continue"/"get started" then look for a calendar grid
    const dayBtn = gs.locator('[role="gridcell"], .rdp-day, button[name="day"]').first();
    const trigger = gs.getByText(/birth|date of birth|birthday/i).first();
    if (await trigger.count()) { await trigger.click({ timeout: 3000 }).catch(() => {}); await gs.waitForTimeout(800); }
    if (await gs.locator('.rdp, [data-slot="calendar"]').count()) {
      await gs.locator('.rdp, [data-slot="calendar"]').first().screenshot({ path: path.join(out, "calendar-disabled.png") }).catch(() => {});
      console.log("calendar screenshot attempted");
    } else {
      console.log("no calendar surfaced on /get-started landing (likely deeper in flow)");
    }
  } catch (e) { console.log("calendar probe skipped:", String(e).slice(0, 60)); }
  await gs.close();
  await b.close();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
