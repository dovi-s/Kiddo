/* eslint-disable no-console */
// Renders the restructured handoff card (Nora, near-majority) so the founder
// can judge the human-first lead (oldest note) over the demoted money line.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 100)); });
  p.on("pageerror", (e) => errs.push("ERR:" + String(e).slice(0, 130)));
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("text-total-balance").first().waitFor({ state: "visible", timeout: 35000 });
  await p.waitForTimeout(1500);

  // Switch to Nora (near-majority fund).
  let onNora = false;
  try {
    await p.getByTestId("sidebar-fund-switcher").first().click();
    await p.waitForTimeout(500);
    const nora = p.getByText(/Nora/i).first();
    if (await nora.count()) { await nora.click(); onNora = true; }
    await p.waitForTimeout(2500);
  } catch (e) { console.log("switch failed:", String(e).slice(0, 80)); }
  console.log("switched to Nora:", onNora, "| url:", p.url());

  // Find the human-lead line + scroll the handoff card into view.
  const lead = p.getByText("The money is only part of it.").first();
  let found = false;
  for (let t = 0; t < 30; t++) {
    if (await lead.count()) { found = true; break; }
    await p.evaluate(() => window.scrollBy(0, 500));
    await p.waitForTimeout(200);
  }
  console.log("human-lead line present:", found);
  if (found) {
    await lead.scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    // Screenshot the handoff card: walk up to the nearest section-ish container.
    const box = await lead.evaluate((el) => {
      let n = el;
      for (let i = 0; i < 8 && n.parentElement; i++) { n = n.parentElement; if (n.offsetHeight > 380) break; }
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: Math.min(r.height, 720) };
    });
    await p.screenshot({ path: path.join(out, "handoff.png"), clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.w, height: box.h } });
  } else {
    await p.screenshot({ path: path.join(out, "handoff.fullpage.png"), fullPage: true });
  }
  console.log(errs.length ? "JS errors: " + [...new Set(errs)].slice(0, 6).join(" | ") : "no JS errors");
  await b.close();
  console.log("-> artifacts/staging/handoff*.png");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
