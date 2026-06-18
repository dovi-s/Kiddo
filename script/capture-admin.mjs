import { chromium } from "playwright";

const BASE = "http://localhost:5000";
const EMAIL = "dovisherman@gmail.com";
const PASSWORD = "dovisherman@gmail.com";
const OUT = "C:/Apps/Kora (newest)/.local";

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('[data-testid="input-login-email"]', EMAIL);
  await page.fill('[data-testid="input-login-password"]', PASSWORD);
  await page.click('[data-testid="button-login"]');
  await page.waitForTimeout(2500);

  // 2FA?
  if (await page.locator('[data-testid="input-2fa-code"]').isVisible().catch(() => false)) {
    console.log("RESULT: BLOCKED_2FA — account requires a 2FA code I can't provide.");
    await page.screenshot({ path: `${OUT}/admin-2fa.png` });
    await browser.close();
    process.exit(0);
  }
  // login error?
  const loginErr = await page.locator('[data-testid="text-login-error"]').textContent().catch(() => null);
  if (loginErr && loginErr.trim()) {
    console.log("RESULT: LOGIN_FAILED — " + loginErr.trim());
    await browser.close();
    process.exit(0);
  }

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const tabCount = await page.locator('[data-testid^="tab-"]').count().catch(() => 0);
  const hasToggle = await page.locator('[data-testid="toggle-diagnostics"]').count().catch(() => 0);
  const url = page.url();
  console.log(`RESULT: at ${url} | tab buttons=${tabCount} | diagnostics toggle present=${hasToggle}`);

  await page.screenshot({ path: `${OUT}/admin-collapsed.png`, fullPage: true });

  // Expand diagnostics, screenshot again
  if (hasToggle) {
    await page.click('[data-testid="toggle-diagnostics"]').catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/admin-expanded.png`, fullPage: true });
  }
  // Just the tab bar region (top)
  await page.screenshot({ path: `${OUT}/admin-topbar.png`, clip: { x: 0, y: 0, width: 1440, height: 220 } });

  console.log("CONSOLE_ERRORS: " + (errors.length ? JSON.stringify(errors, null, 2) : "none"));
} catch (e) {
  console.log("SCRIPT_ERROR: " + e.message);
  console.log("CONSOLE_ERRORS: " + JSON.stringify(errors, null, 2));
} finally {
  await browser.close();
}
