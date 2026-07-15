import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = "C:/Users/dovis/AppData/Local/Temp/claude/C--Apps-Kora--newest-/f17761f7-f53a-4006-bca7-fa282aa6efde/scratchpad";

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

await p.goto(base + "/theo-rivera", { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(2500);

// Landing → amount
await p.getByTestId("button-start-gift").first().click({ timeout: 15000 }).catch(() => console.log("no start-gift"));
await p.waitForTimeout(1500);
// pick $50 if a preset exists (to enable Continue)
await p.getByText("$50", { exact: false }).first().click({ timeout: 4000 }).catch(() => {});
await p.waitForTimeout(600);
await p.screenshot({ path: out + "/gift-amount.png", fullPage: false });
console.log("shot gift-amount");

// amount → preview
await p.getByTestId("button-continue-to-preview").click({ timeout: 8000 }).catch(() => console.log("no continue-to-preview"));
await p.waitForTimeout(1500);
// Top of preview
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(400);
await p.screenshot({ path: out + "/gift-preview-top.png", fullPage: false });
// Scroll into the MIDDLE of the company list — proves the Continue bar floats.
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
await p.waitForTimeout(500);
await p.screenshot({ path: out + "/gift-preview-mid.png", fullPage: false });
console.log("shot gift-preview mid");

await b.close();
