import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });
const THEO = "48a416e1-4b4e-45f7-8a1e-7c8524b42c0e";

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
async function login() {
  await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 });
  await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
  await p.getByTestId("input-login-password").fill("riverafamily");
  await p.getByTestId("button-login").click();
  await p.waitForURL(/fund=|dashboard/i, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
}
await login();
for (let i = 0; i < 3 && /\/login/.test(p.url()); i++) { console.log("login retry", i, p.url()); await login(); }
console.log("post-login url:", p.url());

// Make sure auth actually settled before leaving for /memory (a fresh goto can
// race the cookie and bounce back to /login).
await p.goto(base + `/dashboard?fund=${THEO}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
await p.goto(base + `/memory/${THEO}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
if (await p.getByTestId("input-login-email").count()) {
  console.log("bounced to login — retrying /memory");
  await p.goto(base + `/memory/${THEO}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
}
await p.waitForTimeout(5000);

// Locate the Elena note by its text, scroll to it (triggers lazy image load).
const note = p.getByText(/you're getting so big/i).first();
const noteCount = await note.count();
console.log("Elena note visible in Memory Book:", noteCount);
if (noteCount) {
  await note.scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(2000);
}
// Now check for the photo (img src or any element referencing it).
const imgCount = await p.locator('img[src*="theo-mom"]').count();
const anyRef = await p.evaluate(() => document.documentElement.innerHTML.includes("theo-mom.jpg"));
console.log("theo-mom img in DOM after scroll (want>=1):", imgCount, "| referenced anywhere:", anyRef);

const photo = p.locator('img[src*="theo-mom"]').first();
if (await photo.count()) {
  await photo.scrollIntoViewIfNeeded().catch(() => {});
  // Wait for the (large) image to actually decode + FadeImage to fade in.
  await photo.evaluate((el) => (el.complete ? Promise.resolve() : new Promise((r) => { el.onload = r; el.onerror = r; }))).catch(() => {});
  await p.waitForTimeout(2500);
  const box = await photo.boundingBox().catch(() => null);
  await p.screenshot({ path: path.join(out, "memory-photo.png"), clip: box ? { x: 0, y: Math.max(0, box.y - 320), width: 393, height: 620 } : undefined }).catch(() => p.screenshot({ path: path.join(out, "memory-photo.png") }));
  const natural = await photo.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight })).catch(() => null);
  console.log("photo naturalSize (loaded if >0):", JSON.stringify(natural));
} else {
  await p.screenshot({ path: path.join(out, "memory-photo.png") });
}
console.log("-> memory-photo.png");
await b.close();
