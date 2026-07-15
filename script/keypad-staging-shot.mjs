import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
try {
  await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
} catch {
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
}
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];

// Recurring flow → amount step (has the keypad).
await p.goto(base + "/staging?fund=" + fund + "&openAutoInvest=1", { waitUntil: "domcontentloaded" });
await p.getByTestId("input-auto-invest-amount").waitFor({ state: "visible", timeout: 30000 }).catch(() => console.log("no register"));
await p.waitForTimeout(2500);

const dlg = p.locator('[role="dialog"]').first();
if (await dlg.count()) {
  // Measure: does the sheet content overflow (need to scroll to reach Continue)?
  const fit = await p.evaluate(() => {
    const dlgEl = document.querySelector('[role="dialog"]');
    const scroller = dlgEl?.querySelector('[class*="overflow-y"]') || dlgEl;
    const cta = document.querySelector('[data-testid="button-auto-invest-next-target"], [data-testid="button-save-auto-invest-amount"]');
    const vh = window.innerHeight;
    const ctaBottom = cta ? cta.getBoundingClientRect().bottom : null;
    return {
      viewportH: vh,
      scrollH: scroller ? scroller.scrollHeight : null,
      clientH: scroller ? scroller.clientHeight : null,
      overflows: scroller ? scroller.scrollHeight > scroller.clientHeight + 2 : null,
      ctaBottom,
      ctaInView: ctaBottom !== null ? ctaBottom <= vh + 1 : null,
    };
  });
  console.log("FIT:", JSON.stringify(fit));
  // Full viewport (not clipped to dialog) so we see whether Continue is reachable without scroll.
  await p.screenshot({ path: path.join(out, "keypad-recurring-viewport.png") });
  console.log("-> keypad-recurring-viewport.png");
  await dlg.screenshot({ path: path.join(out, "keypad-recurring-initial.png") });
  console.log("-> keypad-recurring-initial.png");

  // Tap keypad to build an amount: clear-ish then type 1 0 8 0
  for (const k of ["back", "back", "1", "0", "8", "0"]) {
    await p.getByTestId(`keypad-key-${k}`).click().catch(() => console.log("miss key", k));
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(600);
  await dlg.screenshot({ path: path.join(out, "keypad-recurring-typed.png") });
  console.log("-> keypad-recurring-typed.png");
  const shown = await p.getByTestId("input-auto-invest-amount").textContent().catch(() => "?");
  console.log("register shows:", shown);
} else {
  console.log("no recurring dialog");
}
await b.close();
