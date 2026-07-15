import path from "node:path";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = "http://127.0.0.1:5000";
const out = path.join(process.cwd(), "artifacts", "staging");
mkdirSync(out, { recursive: true });

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

// Discover funds + find the schedule that has a recent failure.
const disco = await p.evaluate(async () => {
  const data = await fetch("/api/me/scheduled", { credentials: "include" }).then(r => r.json()).catch(() => ({}));
  return (data?.contributions ?? []).map(s => ({
    fundId: s.fundId, scheduleId: s.id, hasRecentFailure: !!s.hasRecentFailure,
    amount: s.amount, status: s.status, exec: s.executionModel,
  }));
});
console.log("schedules:", JSON.stringify(disco, null, 2));
const failing = disco.find(s => s.hasRecentFailure) || disco[0];
if (!failing) { console.log("NO SCHEDULE FOUND"); await b.close(); process.exit(0); }
console.log("using:", JSON.stringify(failing));

const detail = `schedule:${failing.scheduleId}`;
await p.goto(base + "/activity?fund=" + failing.fundId + "&detail=" + encodeURIComponent(detail), { waitUntil: "domcontentloaded" });
const dlg = p.locator('[data-testid="detail-history-modal"]').first();
try { await dlg.waitFor({ state: "visible", timeout: 25000 }); }
catch { console.log("dialog never opened; url:", p.url()); }
await p.waitForTimeout(1500);
console.log("dialog open:", await dlg.count());
// Ensure we're on History (where the failed row lives).
await p.getByTestId("detail-tab-history").click().catch(() => console.log("no history tab"));
await p.waitForTimeout(1000);
if (await dlg.count()) {
  await dlg.screenshot({ path: path.join(out, "failed-detail.png") });
  console.log("-> failed-detail.png");
}
await b.close();
