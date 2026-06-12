/* eslint-disable no-console */
// Verify the desktop sidebar follows fund switches (no "stuck on Luke" desync).
// Three cases: (A) cold deep-link ?fund=X seeds the sidebar; (B) an active-fund
// change event with a STALE URL (the reported bug) still moves the sidebar;
// (C) a real URL ?fund change moves it. Throwaway diagnostic.
import { chromium } from "playwright";

const BASE = process.env.WIL_BASE_URL || "http://127.0.0.1:5000";
const LUKE = "49b42391-2540-47d0-97e5-58abf0d3c179";
const ALEX = "41562560-4581-4971-bfbb-3cec4534ca24";

const results: { name: string; ok: boolean; got: string }[] = [];
const rec = (name: string, ok: boolean, got: string) => { results.push({ name, ok, got }); console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${got}`); };

async function sidebarText(page: any): Promise<string> {
  return (await page.getByTestId("sidebar-fund-switcher").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}
async function waitForName(page: any, name: string, ms = 6000): Promise<boolean> {
  const dl = Date.now() + ms;
  while (Date.now() < dl) {
    if (new RegExp(name, "i").test(await sidebarText(page))) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addInitScript(() => { try { sessionStorage.setItem("kora-launched", "1"); } catch { /* noop */ } });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email: "claire@dunphyfamily.com", password: "dunphyfamily" }) });
    });

    // A) Cold deep-link to Alex seeds the sidebar from the URL.
    await page.goto(`${BASE}/dashboard?fund=${ALEX}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='sidebar-fund-switcher']", { timeout: 20_000 });
    const aOk = await waitForName(page, "Alex");
    rec("A. deep-link ?fund=Alex seeds sidebar", aOk, await sidebarText(page));

    // B) THE BUG: land on ?fund=Luke, then fire an active-fund change to Alex
    //    WITHOUT changing the URL (mimics DashboardLab's render-time
    //    setActiveFundId / a replaceState switch). Sidebar must follow to Alex.
    await page.goto(`${BASE}/dashboard?fund=${LUKE}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='sidebar-fund-switcher']", { timeout: 20_000 });
    const startedLuke = await waitForName(page, "Luke");
    rec("B0. starts on Luke (?fund=Luke)", startedLuke, await sidebarText(page));
    await page.evaluate((id) => {
      localStorage.setItem("kiddo_active_fund_id", id);
      window.dispatchEvent(new CustomEvent("kiddo:active-fund-change", { detail: { id } }));
    }, ALEX);
    const movedToAlex = await waitForName(page, "Alex");
    const stillHasLuke = /Luke/i.test(await sidebarText(page));
    rec("B. stale-URL switch event moves sidebar to Alex", movedToAlex && !stillHasLuke, await sidebarText(page));

    // C) A real URL ?fund change (back/forward / deep-link nav) moves it.
    await page.goto(`${BASE}/dashboard?fund=${LUKE}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='sidebar-fund-switcher']", { timeout: 20_000 });
    await waitForName(page, "Luke");
    await page.goto(`${BASE}/dashboard?fund=${ALEX}`, { waitUntil: "domcontentloaded" });
    const cOk = await waitForName(page, "Alex");
    rec("C. real URL ?fund change moves sidebar", cOk, await sidebarText(page));
  } finally {
    await browser.close();
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed.`);
  process.exit(passed === results.length ? 0 : 1);
}
main().catch((e) => { console.error("verify-sidebar-sync crashed:", e); process.exit(1); });
