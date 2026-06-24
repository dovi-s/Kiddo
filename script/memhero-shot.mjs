import path from "node:path";import { mkdirSync } from "node:fs";import { chromium, devices } from "playwright";
const base="http://127.0.0.1:5000";const out=path.join(process.cwd(),"artifacts","dash");mkdirSync(out,{recursive:true});
const b=await chromium.launch();const p=await (await b.newContext({...devices["iPhone 14 Pro"],deviceScaleFactor:3})).newPage();
await p.addInitScript(()=>sessionStorage.setItem("kora-launched","1"));
await p.goto(base+"/login",{waitUntil:"domcontentloaded"});
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/dashboard|funds|\/$/i,{timeout:60000}).catch(()=>{});
await p.waitForURL(/fund=/i,{timeout:15000}).catch(()=>{});
const fund=(p.url().match(/fund=([a-f0-9-]+)/i)||[])[1];
await p.goto(base+"/memory"+(fund?`?fund=${fund}`:""),{waitUntil:"domcontentloaded"});
await p.locator('[data-testid="memory-hero"]').waitFor({state:"visible",timeout:30000}).catch(()=>{});
await p.waitForTimeout(3500);
const el=p.locator('[data-testid="memory-hero"]').first();
if(await el.count()){await el.screenshot({path:path.join(out,"memhero.png")});console.log("-> memhero.png");}
else console.log("memory-hero not found");
await b.close();
