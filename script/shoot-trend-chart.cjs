// One-off: verify the DashboardTrendChart renders after the heartbeat/morph
// change. Logs into the Rivera demo, opens the dashboard, screenshots the
// "growth" chart region. Motion (pulse/morph) can't be captured in a still;
// this just proves it renders with today's dot and no runtime crash.
const { chromium } = require("playwright-core");

(async () => {
  const base = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 440, height: 1600 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  try {
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Fill the demo creds.
    await page.fill('input[type="email"]', "elena@riverafamily.com").catch(() => {});
    await page.fill('input[type="password"]', "riverafamily").catch(() => {});
    await page.keyboard.press("Enter");
    await page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {});
    // Let the dashboard + lazy trend chart settle.
    await page.waitForTimeout(8000);
    // Hero shot (top of page) — verify the projection tilde.
    await page.screenshot({ path: "artifacts/ui-smoke/hero-projection.png", fullPage: false });
    // Expand the growth section (it's collapsed by default), then settle.
    const growth = page.getByText("Theo's growth", { exact: false }).first();
    await growth.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
    await growth.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await growth.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: "artifacts/ui-smoke/trend-chart-alive.png", fullPage: false });
    // Report whether the SVG path actually rendered.
    const hasPath = await page.locator("svg path.recharts-area-area, svg .recharts-area").count();
    console.log("OK screenshot saved · recharts area elements:", hasPath);
    console.log("URL:", page.url());
  } catch (e) {
    console.log("FAIL:", e.message);
  } finally {
    await browser.close();
  }
})();
