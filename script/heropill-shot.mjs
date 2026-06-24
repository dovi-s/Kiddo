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
await p.goto(base+"/staging"+(fund?`?fund=${fund}`:""),{waitUntil:"domcontentloaded"});
await p.locator('[data-testid="hero-card"]').waitFor({state:"visible",timeout:30000}).catch(()=>{});
await p.waitForTimeout(3500);
const box=await p.evaluate(()=>{
  const els=Array.from(document.querySelectorAll("button"));
  const el=els.find(b=>/at \d+/.test(b.textContent||"")&&/\$/.test(b.textContent||"")&&b.getClientRects().length>0);
  if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};
});
if(box){const pad=18;await p.screenshot({path:path.join(out,"heropill.png"),clip:{x:Math.max(0,box.x-pad),y:Math.max(0,box.y-pad),width:Math.min(393,box.w+pad*2),height:box.h+pad*2}});console.log("-> heropill.png");}
else console.log("pill not found");
await b.close();
