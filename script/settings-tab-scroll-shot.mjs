import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";

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

await p.goto(base + "/settings?fund=" + fund, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(7000);

// On the Child tab: scroll down a good bit.
await p.evaluate(() => window.scrollTo(0, 900));
await p.waitForTimeout(400);
const beforeY = await p.evaluate(() => Math.round(window.scrollY));

// Switch to the Gifts tab.
await p.getByTestId("settings-tab-gifts").click().catch(() => console.log("no gifts tab"));
await p.waitForTimeout(600);
const afterY = await p.evaluate(() => Math.round(window.scrollY));

console.log("scrollY before switch:", beforeY, "| after switch:", afterY, "| landed at top:", afterY === 0);
await b.close();
