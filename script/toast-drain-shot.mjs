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

await p.goto(base + `/staging?fund=${FUND}&openAutoInvest=1&editId=${SCHED}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
await p.getByTestId("button-frequency-weekly").click().catch(() => {});
await p.waitForTimeout(400);
await p.getByTestId("button-save-auto-invest-amount").click().catch(() => console.log("no save"));

// Toast is "Not saved in the demo" (default card, 4500ms) -> drain bar (evergreen).
await p.waitForTimeout(500);
const toastCount = await p.getByTestId("toast-progress").count();
const clip = { x: 0, y: 0, width: 393, height: 170 };
await p.screenshot({ path: path.join(out, "toast-drain-early.png"), clip });
await p.waitForTimeout(2200);
await p.screenshot({ path: path.join(out, "toast-drain-late.png"), clip });
console.log("toast-progress bars present:", toastCount);
await b.close();
