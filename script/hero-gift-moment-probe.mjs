/* eslint-disable no-console */
// Captures the gift-lands "moment" on <HeroMoment> (/hero-preview): the ARC
// chip (principle 7) lingering LOW then curving up into the balance + the
// secondary balance breath (principle 8), in BOTH normal and reduced-motion.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "dash");
mkdirSync(out, { recursive: true });

async function run(b, label, reduced) {
  const ctx = await b.newContext({ viewport: { width: 760, height: 700 }, deviceScaleFactor: 2 });
  if (reduced) await ctx.newPage().then((pp) => pp.close()); // noop to keep ctx
  const p = await ctx.newPage();
  if (reduced) await p.emulateMedia({ reducedMotion: "reduce" });
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 90)); });
  p.on("pageerror", (e) => errs.push("ERR:" + String(e).slice(0, 110)));
  await p.goto(base + "/hero-preview", { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(700);

  const hero = p.getByTestId("hero-moment");
  await p.getByTestId("hero-preview-play-gift").click();

  // Sample across the flight. With the linger, the chip sits LOW (visible)
  // from ~230-580ms before rising, so the early frames now read clearly.
  const marks = reduced
    ? [{ t: 350, n: "reduced-mid" }, { t: 350, n: "reduced-late" }]
    : [{ t: 200, n: "a-appear" }, { t: 220, n: "b-hold-low" }, { t: 350, n: "c-rising" }, { t: 250, n: "d-breath" }];
  let elapsed = 0;
  for (const m of marks) {
    await p.waitForTimeout(m.t);
    elapsed += m.t;
    const arc = await p.evaluate(() => {
      const el = document.querySelector('[data-testid="hero-moment-gift-arc"]');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { transform: cs.transform, opacity: cs.opacity };
    });
    console.log(`[${label}] ~${elapsed}ms`, arc ? `op=${Number(arc.opacity).toFixed(2)} ${arc.transform}` : "arc gone");
    await hero.screenshot({ path: path.join(out, `gift-moment.${label}.${m.n}.png`) });
  }
  console.log(`[${label}]`, errs.length ? "JS errors: " + [...new Set(errs)].slice(0, 5).join(" | ") : "no JS errors");
  await p.close();
  await ctx.close();
}

const b = await chromium.launch();
await run(b, "normal", false);
await run(b, "reduced", true);
await b.close();
console.log("-> artifacts/dash/gift-moment.*.png");
