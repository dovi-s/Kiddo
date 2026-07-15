import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = "C:/Users/dovis/AppData/Local/Temp/claude/C--Apps-Kora--newest-/f17761f7-f53a-4006-bca7-fa282aa6efde/scratchpad";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched","1"));
await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
try { await p.getByTestId("input-login-email").waitFor({ state:"visible", timeout:45000 }); }
catch { await p.reload({ waitUntil:"domcontentloaded" }); await p.getByTestId("input-login-email").waitFor({ state:"visible", timeout:45000 }); }
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];
// Warm the ["/api/funds"] cache via the dashboard first (Age18Plan reads it directly),
// and set the active-fund localStorage key it resolves from.
await p.goto(base + "/staging?fund=" + fund, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(6000);
await p.evaluate((f) => localStorage.setItem("kiddo_active_fund_id", f), fund);
await p.goto(base + "/age-18-plan?fund=" + fund, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(6000);
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
await p.screenshot({ path: out + "/at21-top.png" });
const t = await p.evaluate(() => document.body.innerText);
const nums = (t.match(/\$[\d,]+/g) || []).slice(0, 8);
console.log("dollar figures near top:", JSON.stringify(nums), "| anchorLine:", /Gifts alone reach|Gifts only, no monthly/.test(t));
await b.close();
