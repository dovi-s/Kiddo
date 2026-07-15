import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const THEO = "48a416e1-4b4e-45f7-8a1e-7c8524b42c0e";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"] })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=|dashboard/i, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(2000);
// Navigate to the projection page, then fetch the endpoint FROM that page's context.
await p.goto(base + `/projection/${THEO}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(6000);
const res = await p.evaluate(async (id) => {
  const r = await fetch(`/api/funds/${id}/parent-contributions`, { credentials: "include" });
  const j = await r.json().catch(() => null);
  const monthlyDom = Array.from(document.querySelectorAll('*')).map(e=>e.textContent||"").find(t=>/\d+.*\/mo/.test(t) && t.length<20) || "(none)";
  return { httpStatus: r.status, rows: Array.isArray(j) ? j.map(c=>({amount:c.amount,status:c.status})) : j, monthlyDom };
}, THEO);
console.log(JSON.stringify(res, null, 1));
await b.close();
