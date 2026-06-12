/* eslint-disable no-console */
// Render check for the gift-status timeline on the gift-success page.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.WIL_BASE_URL || "http://127.0.0.1:5000";
const OUT = path.join(process.cwd(), "artifacts", "verify-gift-timeline");

async function main() {
  mkdirSync(OUT, { recursive: true });
  const LUKE = String((await (await fetch(`${BASE}/api/public/funds/luke-dunphy`)).json())?.fund?.id || "");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 1200 } });
  await context.addInitScript(() => { try { sessionStorage.setItem("kora-launched", "1"); } catch { /* noop */ } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email: "claire@dunphyfamily.com", password: "dunphyfamily" }) });
    });
    await page.goto(`${BASE}/gift/success?demo=1&fundId=${LUKE}&amount=75&senderName=Gloria`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='text-success-heading']", { timeout: 20_000 });
    const timelineVisible = await page.getByTestId("gift-status-timeline").isVisible().catch(() => false);
    const txt = await page.getByTestId("gift-status-timeline").innerText().catch(() => "");
    await page.waitForTimeout(900); // let the fill + pulse settle for the shot
    await page.screenshot({ path: path.join(OUT, "success-with-timeline.png"), fullPage: true }).catch(() => null);
    // Tight crop around the timeline for a close look.
    const box = await page.getByTestId("gift-status-timeline").boundingBox().catch(() => null);
    if (box) await page.screenshot({ path: path.join(OUT, "timeline-closeup.png"), clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(430, box.width + 16), height: box.height + 16 } }).catch(() => null);
    console.log(`timelineVisible=${timelineVisible}  steps="${txt.replace(/\s+/g, " ").trim()}"  pageErrors=${errors.length}`);
    if (errors.length) console.log("  errors: " + errors.slice(0, 3).join(" | "));
    console.log(`\n${timelineVisible && errors.length === 0 ? "PASS" : "FAIL"} — shots in ${OUT}`);
    process.exit(timelineVisible && errors.length === 0 ? 0 : 1);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });
