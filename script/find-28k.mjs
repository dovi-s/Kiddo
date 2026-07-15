import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const THEO = "48a416e1-4b4e-45f7-8a1e-7c8524b42c0e";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
async function login() {
  await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/fund=|dashboard/i, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
}
await login();
for (let i = 0; i < 3 && /\/login/.test(p.url()); i++) await login();
await p.goto(base + `/dashboard?fund=${THEO}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(7000);
await p.getByTestId("header-fund-name").click().catch(() => {});
await p.waitForTimeout(700);
await p.getByRole("option").filter({ hasText: /Theo/ }).first().click().catch(() => {});
await p.waitForTimeout(8000);

const hits = await p.evaluate(() => {
  const out = [];
  const walk = (el) => {
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        const t = node.textContent || "";
        if (/\$?\s?2[0-9]([.,]?\d)*\s?[Kk]?/.test(t) && /(2[0-9]|21|At |Potential|K)/.test(t)) {
          const parent = node.parentElement;
          if (parent && /(\$|K|21|At|Potential|by)/i.test(t)) out.push({ text: t.trim().slice(0, 50), cls: (parent.className || "").toString().slice(0, 40) });
        }
      } else if (node.nodeType === 1) walk(node);
    }
  };
  walk(document.body);
  // Any text with a $ K-amount OR "at N" OR "by 21" OR "28"
  const all = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el.children.length === 0) {
      const t = (el.textContent || "").trim();
      if (t && /(\$\s?\d[\d.,]*\s?K|~\$|At \d|by 21|28[Kk]?|projected|Potential|on track)/i.test(t) && t.length < 70) {
        all.push(t);
      }
    }
  });
  return { balance: document.querySelector('.ch-balance')?.textContent || "", hits: [...new Set(all)].slice(0, 50) };
});
console.log("balance:", hits.balance);
console.log(JSON.stringify(hits.hits, null, 1));
await b.close();
