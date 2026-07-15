/* eslint-disable no-console */
// Verifies the LIVE gift-lands beat on /staging: drives the REAL one-time
// contribution flow (which calls recordDemoLiveGift -> the choreography fires),
// then captures the +$X arc (principle 7) curving into the balance + the
// secondary balance breath (principle 8). Single authenticated page throughout.
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
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const REDUCED = !!process.env.REDUCED;
  if (REDUCED) { await p.emulateMedia({ reducedMotion: "reduce" }); console.log("[reduced-motion emulated]"); }
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 110)); });
  p.on("pageerror", (e) => errs.push("ERR:" + String(e).slice(0, 140)));
  await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

  await p.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("input-login-email").fill(EMAIL);
  await p.getByTestId("input-login-password").fill(PASSWORD);
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);

  await p.goto(base + "/staging", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByTestId("text-total-balance").first().waitFor({ state: "visible", timeout: 35000 });
  await p.waitForTimeout(2000); // baseline gift acked on first view
  const hero = p.getByTestId("hero-card");
  await hero.screenshot({ path: path.join(out, "gift.0-rest.png") });

  // Open the one-time contribution modal (inside a collapsible; Playwright
  // auto-scrolls it into view).
  const opener = p.getByTestId("chip-add-onetime").or(p.getByTestId("button-one-time-contribution-v2")).first();
  await opener.scrollIntoViewIfNeeded({ timeout: 15000 });
  await opener.click({ timeout: 15000 });
  await p.waitForTimeout(700);
  const dialogOpen = await p.getByRole("dialog").count();
  console.log("dialog open after opener click:", dialogOpen);
  await p.screenshot({ path: path.join(out, "gift.modal-open.png") });

  // Step through amount -> target -> review by clicking Continue until the
  // final "Invest $X" button appears, then submit.
  for (let i = 0; i < 6; i++) {
    const names = await p.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).map((b) => b.textContent.trim().slice(0, 24)).filter(Boolean));
    console.log(`  step ${i} dialog buttons:`, JSON.stringify(names));
    const dlg = p.getByRole("dialog");
    const invest = dlg.getByRole("button", { name: /^Invest \$/i });
    if (await invest.count() && await invest.first().isVisible().catch(() => false)) {
      await invest.first().click();
      console.log("  clicked INVEST");
      break;
    }
    const cont = dlg.getByRole("button", { name: /^Continue$/i });
    if (await cont.count() && await cont.first().isVisible().catch(() => false)) {
      await cont.first().click();
      await p.waitForTimeout(450);
      continue;
    }
    await p.waitForTimeout(300);
  }

  // Modal closes + recordDemoLiveGift fires. Bring the hero into view so the
  // choreography's heroInView gate opens, then catch the arc.
  await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 0));

  let sawArc = false;
  const frames = [];
  for (let t = 0; t < 32; t++) { // ~3.2s poll, ~100ms cadence
    const arc = await p.evaluate(() => {
      const el = document.querySelector('[data-testid="hero-gift-arc"]');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { transform: cs.transform, opacity: cs.opacity, text: el.textContent };
    });
    if (arc) {
      sawArc = true;
      frames.push(`opacity=${Number(arc.opacity).toFixed(2)} ${arc.transform} "${arc.text}"`);
      if (frames.length <= 4) await hero.screenshot({ path: path.join(out, `gift.${frames.length}-arc.png`) });
    }
    await p.waitForTimeout(100);
  }

  console.log("saw arc:", sawArc, "| samples:", frames.length);
  frames.slice(0, 6).forEach((f, i) => console.log(`  arc[${i}]`, f));
  const balClass = await p.evaluate(() => {
    const el = document.querySelector('[data-testid="text-total-balance"]');
    return el?.parentElement?.className || "(none)";
  });
  console.log("balance wrapper class during/after:", balClass);
  if (errs.length) console.log("JS errors:", [...new Set(errs)].slice(0, 8).join(" | "));
  else console.log("no JS errors");

  await b.close();
  console.log("-> artifacts/staging/gift.*.png");
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
