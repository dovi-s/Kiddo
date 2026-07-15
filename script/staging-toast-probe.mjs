/* eslint-disable no-console */
// Verifies the loop-closure TOAST fires on /staging (the route I just added to
// DemoGiftMoment.onDashboard). Simulates what a role-played gift SEND leaves
// behind — the PENDING_KEY in sessionStorage — then loads /staging fresh and
// waits for the "watch it land" toast (fires after JUST_SENT_DELAY_MS = 4.8s).
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });

const PENDING_KEY = "kiddo.demo.pendingGift.v1";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);

  // Stash a just-sent gift (fundId "x" falls back to funds[0] in DemoGiftMoment).
  await p.evaluate((key) => {
    sessionStorage.setItem(key, JSON.stringify({ fundId: "x", senderName: "Sofia", amount: "75" }));
  }, PENDING_KEY);

  // Fresh load of /staging so DemoGiftMoment mounts there and reads the key.
  await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });

  let toastText = null;
  for (let t = 0; t < 90; t++) { // up to ~9s (toast arms at 4.8s)
    const hit = await p.evaluate(() => {
      const txt = document.body.innerText;
      const m = txt.match(/Sofia[^\n]*\$75[^\n]*/);
      return m ? m[0].slice(0, 120) : null;
    });
    if (hit) { toastText = hit; break; }
    await p.waitForTimeout(100);
  }

  console.log("toast fired on /staging:", !!toastText);
  if (toastText) console.log("  text:", JSON.stringify(toastText));
  await p.screenshot({ path: path.join(out, "toast.staging.png") });
  await b.close();
  console.log("-> artifacts/staging/toast.staging.png");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
