import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"] })).newPage();
await p.addInitScript(()=>sessionStorage.setItem("kora-launched","1"));
await p.goto(base+"/login",{waitUntil:"domcontentloaded"});
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i,{timeout:30000}).catch(()=>{});
await p.goto(base+"/dashboard",{waitUntil:"domcontentloaded"});
await p.waitForTimeout(11000);
// open recurring flow
let opened=false;
for (const sel of ["button-setup-auto-invest-v2","chip-recurring-status"]) {
  const el = p.getByTestId(sel).first();
  if (await el.count()) { await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click().catch(()=>{}); opened=true; break; }
}
if(!opened){ const t=p.getByText(/Set up recurring/i).first(); if(await t.count()){await t.click().catch(()=>{});opened=true;} }
await p.waitForTimeout(1500);
const amt = p.getByTestId("input-auto-invest-amount").first();
console.log("opened:",opened,"| amount input present:", await amt.count());
if (await amt.count()) {
  await amt.fill("25").catch(async()=>{ await amt.click(); await p.keyboard.type("25"); });
  await p.waitForTimeout(4000); // let fv compute
  const txt = await p.evaluate(()=>document.body.innerText);
  console.log("has 'into': ", /into .*fund/i.test(txt), "| has 'About ': ", /About \$/.test(txt), "| has '→ roughly':", /→ roughly/.test(txt), "| has 'Time is what compounds':", /Time is what compounds/.test(txt));
  await p.screenshot({ path:"script/rec.png" });
}
await b.close();
