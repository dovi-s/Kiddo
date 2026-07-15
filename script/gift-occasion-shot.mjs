import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = "C:/Users/dovis/AppData/Local/Temp/claude/C--Apps-Kora--newest-/f17761f7-f53a-4006-bca7-fa282aa6efde/scratchpad";
const url = base + "/theo-rivera/theo-rivera-bday-2026";

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

await p.goto(url, { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(2500);

// Landing: now just a "Gift Theo" CTA (no inline picker) — same as fund landing.
const cta = p.getByTestId("button-start-gift").first();
await cta.scrollIntoViewIfNeeded().catch(() => {});
await p.waitForTimeout(300);
await p.screenshot({ path: out + "/occ2-landing-cta.png", fullPage: false });

// Landing → shared AMOUNT step (this is the unification: occasion no longer skips it)
await cta.click({ timeout: 8000 }).catch(() => console.log("no start-gift click"));
await p.waitForTimeout(1400);
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
await p.screenshot({ path: out + "/occ2-amount.png", fullPage: false });
console.log("amount step shown");

// Amount → preview
await p.getByText("$50", { exact: true }).first().click({ timeout: 4000 }).catch(() => {});
await p.waitForTimeout(400);
await p.getByTestId("button-continue-to-preview").click({ timeout: 8000 }).catch(() => console.log("no continue-to-preview"));
await p.waitForTimeout(1400);
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
await p.screenshot({ path: out + "/occ2-preview-top.png", fullPage: false });
console.log("preview shown");

await b.close();
