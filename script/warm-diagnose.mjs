/* eslint-disable no-console */
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const dump = async (p, label) => {
  const s = await p.evaluate(() => {
    const out = {};
    let total = 0;
    for (const k of Object.keys(localStorage)) {
      const v = localStorage.getItem(k) || "";
      total += k.length + v.length;
      if (k.startsWith("kiddo") || k === "kiddo_active_fund_id") out[k] = v.length;
    }
    return { total, kiddoKeys: out };
  });
  console.log(`[${label}] total localStorage: ${(s.total/1024).toFixed(0)}KB`);
  for (const [k, sz] of Object.entries(s.kiddoKeys)) console.log(`    ${k} = ${(sz/1024).toFixed(1)}KB`);
};
async function balanceMs(p) {
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) {
    const r = await p.evaluate(() => {
      const els = [...document.querySelectorAll('[data-testid="text-total-balance"]')];
      for (const el of els) { const t=(el.textContent||"").trim(); if ((el.offsetParent!==null) && /\$[\d,]+/.test(t)) return t; }
      return null;
    });
    if (r) return { ms: Date.now()-t0, bal: r };
    await p.waitForTimeout(200);
  }
  return { ms: null, bal: null };
}
async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 14 Pro"] });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", m => { if (m.type()==="error") errs.push(m.text().slice(0,90)); });
  await p.addInitScript(() => sessionStorage.setItem("kora-launched","1"));
  await p.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:60000});
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i,{timeout:60000}).catch(()=>{});
  await p.goto(base+"/dashboard",{waitUntil:"domcontentloaded",timeout:60000});
  const cold = await balanceMs(p);
  console.log(`COLD balance in ${cold.ms}ms (${cold.bal})`);
  await dump(p, "after COLD");
  // reload = warm path from localStorage
  await p.reload({waitUntil:"domcontentloaded"}).catch(()=>{});
  const warm = await balanceMs(p);
  console.log(`WARM(reload) balance in ${warm.ms}ms (${warm.bal})`);
  await dump(p, "after WARM");
  if (errs.length) console.log("console errors:", [...new Set(errs)].slice(0,6));
  await b.close();
}
main().catch(e=>{console.error(String(e));process.exit(1);});
