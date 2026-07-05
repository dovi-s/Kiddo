import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
await p.goto("http://127.0.0.1:5000/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(2000);
const html = await p.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  return { width: cs.scrollbarWidth, color: cs.scrollbarColor };
});
console.log("RESULT html scrollbar-width:", html.width, "| scrollbar-color:", html.color);
await b.close();
