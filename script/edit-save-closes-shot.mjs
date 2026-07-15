import { chromium, devices } from "playwright";
const base = "http://127.0.0.1:5000";
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
const dlg = p.locator('[role="dialog"]').first();
console.log("dialog open (before save):", await dlg.count());

// Change the amount so there ARE edits (Save enabled), then Save.
await p.getByTestId("button-frequency-weekly").click().catch(() => console.log("no weekly"));
await p.waitForTimeout(500);
await p.getByTestId("button-save-auto-invest-amount").click().catch(() => console.log("no save btn"));
await p.waitForTimeout(2500);

const stillOpen = await p.locator('[data-testid="detail-history-modal"], [role="dialog"]').filter({ hasText: "Edit your recurring investment" }).count();
const anyDialog = await p.locator('[role="dialog"]').count();
const toast = await p.locator('text=/Not saved in the demo|Recurring investment updated/i').count();
console.log("edit dialog still open after save:", stillOpen, "| any dialog:", anyDialog, "| confirmation toast:", toast);
await b.close();
