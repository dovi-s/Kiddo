import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });
const MIA = "e63f4477-6e47-413f-a3e7-508bda1d4f0d";

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
const MIA_ID = "e63f4477-6e47-413f-a3e7-508bda1d4f0d";
await p.addInitScript((mia) => { sessionStorage.setItem("kora-launched", "1"); localStorage.setItem("kiddo_active_fund_id", mia); }, MIA_ID);
async function login() {
  await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/fund=|dashboard/i, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
}
await login();
for (let i = 0; i < 3 && /\/login/.test(p.url()); i++) await login();

await p.goto(base + `/dashboard?fund=${MIA}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
if (await p.getByTestId("input-login-email").count()) { await p.goto(base + `/dashboard?fund=${MIA}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(7000); }

const info = await p.evaluate(() => {
  const hero = document.querySelector('[data-testid="hero-card"]');
  const share = document.querySelector('[data-testid="hero-share"]');
  const story = Array.from(document.querySelectorAll('*')).find(el => /Your part of the story/i.test(el.textContent || "") && el.children.length < 8);
  return {
    heroFound: !!hero,
    heroShareButton: !!share,
    heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : null,
    storyFound: !!story,
  };
});
console.log("INFO:", JSON.stringify(info));
await p.screenshot({ path: path.join(out, "graduated-lab.png"), fullPage: true });
console.log("-> graduated-lab.png (fullPage)");
await b.close();
