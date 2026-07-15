import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });
const FUND = "f9446a97-8774-49dc-b618-006571f5dbe0";
const SCHED = "9b4ce3d0-03f1-4b5f-811e-c7dff019a8a6";

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 14 Pro"], deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("kora-launched", "1"));

await p.goto(base + "/login", { waitUntil: "domcontentloaded" });
try { await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
catch { await p.reload({ waitUntil: "domcontentloaded" }); await p.getByTestId("input-login-email").waitFor({ state: "visible", timeout: 45000 }); }
await p.getByTestId("input-login-email").fill("elena@riverafamily.com");
await p.getByTestId("input-login-password").fill("riverafamily");
await p.getByTestId("button-login").click();
await p.waitForURL(/fund=/i, { timeout: 30000 }).catch(() => {});

await p.goto(base + `/staging?fund=${FUND}&openManage=${SCHED}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);

// Action sheet (Edit / Skip next charge / Pause / Cancel).
const sheet = p.locator('[role="dialog"]').first();
await sheet.screenshot({ path: path.join(out, "manage-sheet.png") }).catch(() => {});
const actions = await p.evaluate(() =>
  ["list-action-skip", "list-action-pause", "list-action-cancel"].map(t => {
    const el = document.querySelector(`[data-testid="${t}"]`);
    return { t, text: el ? (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) : null };
  })
);
console.log("ACTIONS:", JSON.stringify(actions));

// Open Pause dialog.
await p.getByTestId("list-action-pause").click().catch(() => console.log("no pause btn"));
await p.waitForTimeout(1200);
const pauseDlg = p.locator('[role="dialog"]').first();
await pauseDlg.screenshot({ path: path.join(out, "pause-dialog.png") }).catch(() => {});
const pauseBtns = await p.evaluate(() =>
  Array.from(document.querySelectorAll('[role="dialog"] button')).map(el => (el.textContent || "").replace(/\s+/g, " ").trim()).filter(t => t && t.length < 80)
);
console.log("PAUSE_BUTTONS:", JSON.stringify(pauseBtns));
await b.close();
