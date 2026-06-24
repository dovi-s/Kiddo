/* eslint-disable no-console */
// Verifies the additive primary-CTA motion on /staging hero (Disney
// principles 1/2/6 + one-shot settle). Static fullPage shots can't show
// :active / :focus-visible / a 1.5s one-shot, so this probe:
//   1. confirms the .lab-cta-primary / .lab-cta-ready classes are LIVE,
//   2. reads computed transition curves (proves the spring is applied),
//   3. captures rest -> held(:active squash) -> released(spring) frames,
//   4. captures the :focus-visible wind-up (keyboard a11y path).
// Single authenticated page throughout (multi-page session handoff was flaky).
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });

const EMAIL = "elena@riverafamily.com";
const PASSWORD = "riverafamily";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

  // Login in this same page, then stay in it.
  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill(EMAIL);
  await p.getByTestId("input-login-password").fill(PASSWORD);
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500);
  console.log("after login URL:", p.url());

  await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });

  const share = p.getByTestId("button-hero-share-link");
  try {
    await share.waitFor({ state: "visible", timeout: 35000 });
  } catch {
    console.log("share button never appeared; URL=", p.url());
    const ids = await p.evaluate(() => Array.from(new Set(Array.from(document.querySelectorAll("[data-testid]")).map((e) => e.getAttribute("data-testid")))).filter((t) => /hero|share|cta|send|balance|empty/i.test(t)));
    console.log("hero-ish testids present:", JSON.stringify(ids));
    await p.screenshot({ path: path.join(out, "cta.0-nohero.png"), fullPage: true });
    await b.close();
    return;
  }
  const hero = p.getByTestId("hero-card");
  await p.waitForTimeout(1200); // let the one-shot settle finish

  // 1 + 2: classes live + computed spring curves
  const info = await share.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { className: el.className, restTransition: cs.transitionTimingFunction };
  });
  console.log("CLASS:", info.className);
  console.log("REST transitionTimingFunction:", info.restTransition, "(back-out spring expected: cubic-bezier(0.34, 1.56, 0.64, 1))");

  await hero.screenshot({ path: path.join(out, "cta.1-rest.png") });

  // 3: hold down -> :active squash & stretch
  const box = await share.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(80);
  const activeInfo = await share.evaluate((el) => ({
    transform: getComputedStyle(el).transform,
    timing: getComputedStyle(el).transitionTimingFunction,
  }));
  console.log("ACTIVE transform (squash, expect scaleX>1 scaleY<1):", activeInfo.transform);
  console.log("ACTIVE timing (ease-in):", activeInfo.timing);
  await hero.screenshot({ path: path.join(out, "cta.2-active-squash.png") });

  // 3b: release -> back-out spring overshoot
  await p.mouse.up();
  await p.waitForTimeout(120);
  await hero.screenshot({ path: path.join(out, "cta.3-release-spring.png") });

  // 4: :focus-visible wind-up via keyboard
  await p.mouse.click(box.x + box.width / 2, box.y - 220);
  await p.waitForTimeout(200);
  let focused = false;
  for (let i = 0; i < 50 && !focused; i++) {
    await p.keyboard.press("Tab");
    await p.waitForTimeout(35);
    focused = await p.evaluate(() => document.activeElement?.getAttribute("data-testid") === "button-hero-share-link");
  }
  console.log("focus-visible reached share button:", focused);
  if (focused) {
    await p.waitForTimeout(250);
    const f = await share.evaluate((el) => getComputedStyle(el).transform);
    console.log("FOCUS-VISIBLE transform (wind-up, expect translateY):", f);
    await hero.screenshot({ path: path.join(out, "cta.4-focus-visible.png") });
  }

  await b.close();
  console.log("-> artifacts/staging/cta.*.png");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
