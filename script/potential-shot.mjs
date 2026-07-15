import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = "C:/Users/dovis/AppData/Local/Temp/claude/C--Apps-Kora--newest-/f17761f7-f53a-4006-bca7-fa282aa6efde/scratchpad";

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
try { await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
catch { await p.reload({ waitUntil: "domcontentloaded" }); await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1] || "48a416e1-4b4e-45f7-8a1e-7c8524b42c0e";
console.log("fund", fund);

await p.goto(base + "/projection/" + fund, { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(3500);

await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
await p.screenshot({ path: out + "/potential-top.png", fullPage: false });
await p.evaluate(() => window.scrollTo(0, window.innerHeight * 0.85)); await p.waitForTimeout(400);
await p.screenshot({ path: out + "/potential-mid.png", fullPage: false });
await p.screenshot({ path: out + "/potential-full.png", fullPage: true });
console.log("done");
await b.close();
