import { chromium, devices } from "playwright";
const base="http://127.0.0.1:5000";
const b=await chromium.launch();
async function check(method){
  const p=await (await b.newContext({...devices["iPhone 14 Pro"]})).newPage();
  await p.addInitScript((m)=>localStorage.setItem("kiddo:last-auth-method", m), method);
  await p.goto(base+"/login",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(1500);
  const badges=await p.locator('[data-testid="badge-last-used"]').count();
  // is the badge near the magic button / shown?
  const magicBadge = await p.locator('[data-testid="button-magic-link-signin"] [data-testid="badge-last-used"]').count();
  console.log(`last=${method}: badges=${badges}, onMagicBtn=${magicBadge}`);
  await p.close();
}
await check("magic");
await check("passkey");
await check("password");
await b.close();
