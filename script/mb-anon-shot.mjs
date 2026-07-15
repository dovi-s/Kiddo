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
const fund = (p.url().match(/fund=([a-f0-9-]+)/i) || [])[1];
await p.goto(base + "/memory/" + fund, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(6000);
// Header count
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
await p.screenshot({ path: out + "/mb-header.png", fullPage: false });
// "Who loves" roster
const who = p.getByText(/Who loves/i).first();
await who.scrollIntoViewIfNeeded().catch(() => {});
await p.waitForTimeout(800);
await p.screenshot({ path: out + "/mb-wholoves.png", fullPage: false });
// Also grep the page text for "Someone"
const hasSomeone = await p.evaluate(() => document.body.innerText.includes("Someone"));
const builtBy = (await p.evaluate(() => (document.body.innerText.match(/Built by \d+ people/) || [])[0])) || "n/a";
console.log("page still contains 'Someone':", hasSomeone, "|", builtBy);
await b.close();
