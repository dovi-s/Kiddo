import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });
const FUND = "f9446a97-8774-49dc-b618-006571f5dbe0";

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
try { await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
catch { await p.reload({ waitUntil: "domcontentloaded" }); await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});

async function shoot(proto) {
  await p.goto(`${base}/staging?heroProto=${proto}&fund=${FUND}`, { waitUntil: "domcontentloaded" });
  await p.locator('[data-testid="hero-card"]').first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);
  // Scroll the hero partially under the 58px header so the seam would show.
  await p.evaluate(() => {
    const hero = document.querySelector('[data-testid="hero-card"]');
    let el = hero?.parentElement;
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if ((s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight) { el.scrollTop = 130; return; }
      el = el.parentElement;
    }
    window.scrollTo(0, 130);
  });
  await p.waitForTimeout(900);
  const info = await p.evaluate(() => {
    const hero = document.querySelector('[data-testid="hero-card"]');
    const hd = document.querySelector('[data-testid="app-header"]');
    return {
      heroTop: hero ? Math.round(hero.getBoundingClientRect().top) : null,
      headerBg: hd ? getComputedStyle(hd).backgroundColor : null,
      landscape: hero ? !!hero.getAttribute("data-landscape") : null,
    };
  });
  console.log(`proto ${proto}:`, JSON.stringify(info));
  await p.screenshot({ path: path.join(out, `hero-seam-${proto}.png`), clip: { x: 0, y: 0, width: 393, height: 240 } });
}

await shoot(0);
await shoot(6);
await b.close();
