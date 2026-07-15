import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = "C:/Users/dovis/AppData/Local/Temp/claude/C--Apps-Kora--newest-/f17761f7-f53a-4006-bca7-fa282aa6efde/scratchpad";
const q = new URLSearchParams({
  demo: "1", amount: "75", fundId: "48a416e1-4b4e-45f7-8a1e-7c8524b42c0e",
  fundName: "Theo's Fund", fundSlug: "theo-rivera", senderName: "Grandma",
  ticker: "DIS", executionModel: "pick",
}).toString();
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto(base + "/gift/success?" + q, { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(3500);
await p.screenshot({ path: out + "/success-before.png", fullPage: true });
const secs = await p.evaluate(() => Array.from(document.querySelectorAll("h1,h2,h3")).map(h => h.textContent.trim()).filter(Boolean).slice(0, 20));
console.log("headers:", JSON.stringify(secs));
await b.close();
