import { chromium, devices } from "playwright";
const base="http://127.0.0.1:5000";
const b=await chromium.launch();
const ctx=await b.newContext({...devices["iPhone 14 Pro"]});
const p=await ctx.newPage();
const logs=[];
p.on("console",m=>{const t=m.text(); if(t.includes("[WARMDBG]")) logs.push(t);});
await p.addInitScript(()=>sessionStorage.setItem("kora-launched","1"));
await p.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:60000});
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/dashboard|funds|\/$/i,{timeout:60000}).catch(()=>{});
await p.goto(base+"/staging",{waitUntil:"domcontentloaded",timeout:60000});
await p.waitForTimeout(16000);
logs.length=0; // clear cold logs
console.log("=== RELOAD (warm) /staging ===");
await p.reload({waitUntil:"domcontentloaded"}).catch(()=>{});
await p.waitForTimeout(16000);
let prev="";
for(const l of logs){ const key=l.replace(/t=\d+/,""); if(key!==prev){ console.log(l.replace("[WARMDBG] ","")); prev=key; } }
console.log(`(total ${logs.length} render logs)`);
await b.close();
