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

await p.goto(base + `/staging?heroProto=6&fund=${THEO}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(8000);
// Ensure Theo is active via the switcher.
await p.getByTestId("header-fund-name").click().catch(() => {});
await p.waitForTimeout(700);
await p.getByRole("option").filter({ hasText: /Theo/ }).first().click().catch(() => {});
await p.waitForTimeout(8000);

console.log("url:", p.url());
await p.screenshot({ path: "artifacts/staging/scrubber-diag.png", fullPage: false });
const info = await p.evaluate(() => {
  const bal = document.querySelector('.ch-balance')?.textContent || "";
  const scrub = document.querySelector('.ps-scrub');
  if (!scrub) return { balance: bal, scrubberFound: false };
  const min = Number(scrub.min), max = Number(scrub.max);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const readAt = (age) => {
    setter.call(scrub, String(age));
    scrub.dispatchEvent(new Event("input", { bubbles: true }));
    return { age, eyebrow: document.querySelector('.ps-eyebrow')?.textContent, num: document.querySelector('.ps-num')?.textContent };
  };
  return { balance: bal, min, max, atToday: readAt(min), at21: readAt(21) };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
