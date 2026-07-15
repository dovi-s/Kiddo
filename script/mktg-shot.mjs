import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
const out = "C:/Users/dovis/AppData/Local/Temp/claude/C--Apps-Kora--newest-/f17761f7-f53a-4006-bca7-fa282aa6efde/scratchpad";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));
for (const [path, name] of [["/about","about"],["/compare","compare"],["/contact","contact"]]) {
  await p.goto(base + path, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/mktg-${name}.png`, fullPage: false });
  console.log("shot " + name);
}
await b.close();
