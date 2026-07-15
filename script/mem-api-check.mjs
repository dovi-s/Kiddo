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
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});
const data = await p.evaluate(async (id) => {
  const r = await fetch(`/api/funds/${id}/memory`, { credentials: "include" });
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.entries || j.memories || []);
  return {
    total: arr.length,
    elenaOrNotes: arr.filter(e => (e.authorName||"").includes("Elena") || e.type === "parent_note")
      .map(e => ({ type: e.type, author: e.authorName, photoUrl: e.photoUrl, visibility: e.visibility, content: String(e.content||"").slice(0,30) })),
  };
}, THEO);
console.log(JSON.stringify(data, null, 2));
await b.close();
