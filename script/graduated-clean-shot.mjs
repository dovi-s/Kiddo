import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });
const THEO = "48a416e1-4b4e-45f7-8a1e-7c8524b42c0e";

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
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

await p.goto(base + `/staging?heroProto=6&fund=${THEO}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(8000);
// Switch to Mia's graduated fund via the header switcher (how the app loads it).
await p.getByTestId("header-fund-name").click().catch(() => console.log("no switcher"));
await p.waitForTimeout(800);
await p.getByRole("option").filter({ hasText: /Mia/ }).first().click().catch(async () => {
  await p.getByText(/Mia's Fund/).first().click().catch(() => console.log("no Mia option"));
});
await p.waitForTimeout(9000);

const info = await p.evaluate(() => {
  const hero = document.querySelector('[data-testid="hero-card"]');
  const share = document.querySelector('[data-testid="hero-share"]');
  const bodyText = document.body.innerText;
  return {
    activeNav: document.querySelector('[data-testid="app-header"]')?.innerText?.split("\n")[0] || "",
    heroFound: !!hero, heroShareButton: !!share,
    heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : null,
    storyFound: /Your part of the story/i.test(bodyText),
    keepsakeShown: /handed it over|handed to|way you handed/i.test(bodyText),
    heroValue: (hero?.querySelector('.ch-balance')?.textContent || "").slice(0, 14),
    hasPotentialScrubber: !!hero?.querySelector('.ch-scrub'),
  };
});
console.log("INFO:", JSON.stringify(info));
await p.screenshot({ path: path.join(out, "graduated-clean.png"), fullPage: true });
console.log("-> graduated-clean.png");
await b.close();
