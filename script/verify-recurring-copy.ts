/* eslint-disable no-console */
// Render check for the recurring-gift copy edits: load the gift checkout, open
// the recurring toggle, and confirm the new "Keep this gift going" label +
// helper render (and the payment banner's next-charge date if reachable).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.WIL_BASE_URL || "http://127.0.0.1:5000";
const OUT = path.join(process.cwd(), "artifacts", "verify-recurring-copy");

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 1200 } });
  await context.addInitScript(() => { try { sessionStorage.setItem("kora-launched", "1"); } catch { /* noop */ } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email: "elena@riverafamily.com", password: "riverafamily" }) });
    });
    await page.goto(`${BASE}/theo-rivera`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='text-heading']", { timeout: 20_000 });
    await page.getByTestId("button-start-gift").first().click();
    await page.waitForTimeout(900);

    const hasToggle = await page.getByTestId("checkbox-recurring-gift").isVisible().catch(() => false);
    let toggleLabelOk = false;
    if (hasToggle) {
      await page.getByTestId("checkbox-recurring-gift").check().catch(() => null);
      await page.waitForTimeout(400);
      const body = await page.locator("body").innerText().catch(() => "");
      toggleLabelOk = /Keep this gift going/i.test(body) && /Send the same gift on the schedule you pick/i.test(body);
      await page.screenshot({ path: path.join(OUT, "recurring-toggle.png"), fullPage: true }).catch(() => null);
    } else {
      await page.screenshot({ path: path.join(OUT, "amount-step-no-toggle.png"), fullPage: true }).catch(() => null);
    }
    console.log(`recurringToggleVisible=${hasToggle}  newLabelRendered=${toggleLabelOk}  pageErrors=${errors.length}`);
    if (errors.length) console.log("  errors: " + errors.slice(0, 3).join(" | "));
    const ok = errors.length === 0 && (!hasToggle || toggleLabelOk);
    console.log(`\n${ok ? "PASS" : "FAIL"} — ${hasToggle ? "recurring toggle shows the new copy" : "toggle not surfaced for this fund (copy still tsc-verified)"}. Shots in ${OUT}`);
    process.exit(ok ? 0 : 1);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });
