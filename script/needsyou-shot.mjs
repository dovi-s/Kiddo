import path from "node:path";import { mkdirSync } from "node:fs";import { chromium, devices } from "playwright";
const base="http://127.0.0.1:5000";const out=path.join(process.cwd(),"artifacts","dash");mkdirSync(out,{recursive:true});
const b=await chromium.launch();const p=await (await b.newContext({...devices["iPhone 14 Pro"],deviceScaleFactor:2})).newPage();
await p.addInitScript(()=>sessionStorage.setItem("kora-launched","1"));
await p.goto(base+"/login",{waitUntil:"domcontentloaded"});
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/dashboard|funds|\/$/i,{timeout:60000}).catch(()=>{});
await p.waitForURL(/fund=/i,{timeout:15000}).catch(()=>{});
const fund=(p.url().match(/fund=([a-f0-9-]+)/i)||[])[1];
await p.goto(base+"/staging"+(fund?`?fund=${fund}`:""),{waitUntil:"domcontentloaded"});
await p.locator('[data-testid="hero-card"]').waitFor({state:"visible",timeout:30000}).catch(()=>{});
await p.waitForTimeout(3500);
const box=await p.evaluate(()=>{const el=document.querySelector('[data-testid="button-invest-cash"]');if(!el)return null;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return{y:r.y,h:r.height};});
await p.waitForTimeout(500);
if(box){await p.screenshot({path:path.join(out,"needsyou.png"),clip:{x:0,y:Math.max(0,box.y-150),width:393,height:Math.min(360,box.h+260)}});console.log("-> needsyou.png (cash card found)");}
else {await p.screenshot({path:path.join(out,"needsyou.png"),clip:{x:0,y:280,width:393,height:360}});console.log("-> needsyou.png (no cash card — uninvestedCash=0 in demo?)");}
await b.close();
