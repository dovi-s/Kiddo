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
const info=await p.evaluate(()=>{
  const se=document.scrollingElement||document.documentElement;
  se.scrollTo(0,se.scrollHeight);
  // measure: last real content element bottom vs page bottom
  const main=document.getElementById("dashboard-main-content");
  const root=document.querySelector(".staging-root");
  const nav=document.querySelector(".mobile-nav-shell");
  const r=(e)=>e?e.getBoundingClientRect():null;
  return {scrollH:se.scrollHeight, vh:window.innerHeight,
    mainBottom: main? main.getBoundingClientRect().bottom: null,
    rootBottom: root? root.getBoundingClientRect().bottom: null,
    navTop: nav? nav.getBoundingClientRect().top: null, navH: nav? nav.getBoundingClientRect().height: null};
});
await p.waitForTimeout(600);
await p.screenshot({path:path.join(out,"bottom.png"),clip:{x:0,y:Math.max(0,852-360),width:393,height:360}});
console.log(JSON.stringify(info)); console.log("-> bottom.png");
await b.close();
