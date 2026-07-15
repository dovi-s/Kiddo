import path from "node:path";import { mkdirSync } from "node:fs";import { chromium, devices } from "playwright";
const base="http://127.0.0.1:5000";const out=path.join(process.cwd(),"artifacts","dash");mkdirSync(out,{recursive:true});
const b=await chromium.launch();
async function shoot(ctx,label,w){
  const p=await ctx.newPage();const errs=[];
  p.on("console",m=>{if(m.type()==="error")errs.push(m.text().slice(0,60));});
  await p.addInitScript(()=>sessionStorage.setItem("kora-launched","1"));
  await p.goto(base+"/login",{waitUntil:"domcontentloaded"});
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/dashboard|funds|\/$/i,{timeout:60000}).catch(()=>{});
  await p.waitForURL(/fund=/i,{timeout:15000}).catch(()=>{});
  const fund=(p.url().match(/fund=([a-f0-9-]+)/i)||[])[1];
  await p.goto(base+"/memory"+(fund?`?fund=${fund}`:""),{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(4500);
  await p.screenshot({path:path.join(out,`memory.${label}.png`),fullPage:true});
  console.log(`-> memory.${label}.png  url=${p.url().slice(0,60)}  ${errs.length?"JS:"+[...new Set(errs)].slice(0,2).join(" | "):"(no JS err)"}`);
  await p.close();
}
await shoot(await b.newContext({...devices["iPhone 14 Pro"],deviceScaleFactor:2}),"mobile",393);
await b.close();
