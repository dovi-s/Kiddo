import { chromium, devices } from "playwright";
const base="http://127.0.0.1:5000";
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
await p.waitForTimeout(4000);
const color=async()=>p.evaluate(()=>{const el=document.querySelector('[data-testid="text-total-balance"]');return el?getComputedStyle(el).color:"?";});
const isGold=(c)=>/rgb/.test(c)&&(()=>{const m=c.match(/\d+/g).map(Number);return m[0]>200&&m[1]>150&&m[2]<160;})();
console.log("baseline:", await color());
// fire both test gifts (small, then big), a beat apart
await p.getByTestId("test-gift-popin").click().catch(()=>{});
await p.waitForTimeout(1200);
await p.getByTestId("test-gift-popin-big").click().catch(()=>{});
let sawGold=false;
for (let i=0;i<14;i++){await p.waitForTimeout(700);const c=await color();if(isGold(c))sawGold=true;if(i%3===0||i>11)console.log(`t+${((i+1)*0.7).toFixed(1)}s after big:`, c, isGold(c)?"GOLD":"");}
const final=await color();
console.log("\nsaw gold during roll:", sawGold, "| FINAL:", final, "|", isGold(final)?"❌ STUCK GOLD":"✅ back to white");
await b.close();
