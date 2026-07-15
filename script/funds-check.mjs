import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"] })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=|dashboard/i, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(1500);
const funds = await p.evaluate(async () => {
  const r = await fetch("/api/funds", { credentials: "include" });
  const j = await r.json();
  return (Array.isArray(j) ? j : []).map(f => ({ name: f.recipientFirstName || f.name, id: f.id, accessRole: f.accessRole, transferredAt: f.transferredAt, valueAtTransfer: f.valueAtTransfer }));
});
console.log("Elena funds:", JSON.stringify(funds, null, 2));
await b.close();
