import path from "node:path";import { mkdirSync } from "node:fs";import { chromium, devices } from "playwright";
const base="http://127.0.0.1:5000";const out=path.join(process.cwd(),"artifacts","staging");mkdirSync(out,{recursive:true});
const b=await chromium.launch();const p=await (await b.newContext({...devices["iPhone 14 Pro"],deviceScaleFactor:2})).newPage();
await p.addInitScript(()=>sessionStorage.setItem("kora-launched","1"));
await p.goto(base+"/login",{waitUntil:"domcontentloaded"});
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i,{timeout:30000}).catch(()=>{});
const fund=(p.url().match(/fund=([a-f0-9-]+)/i)||[])[1];
await p.goto(base+"/staging?fund="+fund+"&openAutoInvest=1",{waitUntil:"domcontentloaded"});
await p.getByTestId("input-auto-invest-amount").waitFor({state:"visible",timeout:30000}).catch(()=>{});
await p.waitForTimeout(2500);
// set an amount so the daily-equivalent + projection render too
await p.getByTestId("input-auto-invest-amount").fill("25").catch(()=>{});
await p.waitForTimeout(1500);
const dlg=p.locator('[role="dialog"]').first();
if(await dlg.count()){await dlg.screenshot({path:path.join(out,"recurring-amount.png")});console.log("-> recurring-amount.png");}
else console.log("no dialog found");
await b.close();
