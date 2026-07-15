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
console.log("fund", fund);

async function settle(ms = 2500) {
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(ms);
}

// Account — capture each tab. Navigate fresh per tab via query so no in-page race.
await p.goto(base + "/account", { waitUntil: "domcontentloaded" });
await p.getByTestId("account-hero").waitFor({ state: "visible", timeout: 30000 }).catch(() => console.log("no hero"));
await settle();
for (const tab of ["personal", "plan", "security"]) {
  const t = p.getByTestId(`account-tab-${tab}`);
  await t.click({ timeout: 8000 }).catch(() => console.log("no tab " + tab));
  await settle(1800);
  await p.screenshot({ path: `${out}/account-${tab}.png`, fullPage: true });
  console.log("shot account-" + tab);
}

// Settings reference — wait for a real card, not the skeleton.
await p.goto(base + "/settings?fund=" + fund, { waitUntil: "domcontentloaded" });
await settle(3500);
await p.screenshot({ path: out + "/ref-settings.png", fullPage: true });
console.log("shot ref-settings");

await b.close();
