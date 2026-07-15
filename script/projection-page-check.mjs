import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
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
// Warm the contributions cache via the dashboard first (how a user gets here — the
// "Potential ›" tap), so we test the shared-cache instant-seed path.
await p.goto(base + `/dashboard?fund=${THEO}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(6000);
await p.getByTestId("header-fund-name").click().catch(() => {});
await p.waitForTimeout(700);
await p.getByRole("option").filter({ hasText: /Theo/ }).first().click().catch(() => {});
await p.waitForTimeout(6000);
await p.goto(base + `/projection/${THEO}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(8000); // shorter wait — cache should seed the monthly fast now
console.log("url:", p.url());
const hits = await p.evaluate(() => {
  const all = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el.children.length === 0) {
      const t = (el.textContent || "").trim();
      if (t && /(\$\s?\d[\d.,]*\s?K?|At \d|by \d|21|28|\/mo|projected|Potential|worth|value|balance)/i.test(t) && /(\$|K|21|28|At |by |value|worth|\/mo)/.test(t) && t.length < 60) all.push(t);
    }
  });
  // Pull the "$X/mo" monthly lever value explicitly.
  let monthly = "";
  document.querySelectorAll('*').forEach((el) => {
    if (el.children.length <= 2 && /\/mo\b/.test(el.textContent || "") && (el.textContent || "").length < 20) monthly = el.textContent.trim();
  });
  return { monthly, all: [...new Set(all)].slice(0, 60) };
});
console.log("monthly lever:", hits.monthly);
console.log(JSON.stringify(hits.all, null, 1));
await p.screenshot({ path: "artifacts/staging/projection-page.png", fullPage: true });
await b.close();
