/* eslint-disable no-console */
// One-off runtime verification of the gifter avatar editor (commit eb2cb61).
// NOT part of the test suite — drives the real app in chromium and captures
// screenshots to artifacts/verify-gifter-avatar/. Assumes a healthy dev
// server on :5000 and the Dunphy demo seed.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-gifter-avatar");
mkdirSync(outDir, { recursive: true });

const shot = (name: string) => path.join(outDir, name);

// 24x24 solid PNG (generated, valid) — the "profile photo" payload.
const RED_DOT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAKklEQVR42mP8z8Dwn4ECwDiqYdSAUQNGDRg1YNSAUQNGDRg1YNSAkWYAAJSkKfH/Cv9tAAAAAElFTkSuQmCC",
  "base64",
);

async function main() {
  const results: string[] = [];
  const ok = (m: string) => { results.push(`PASS  ${m}`); console.log(`PASS  ${m}`); };
  const probe = (m: string) => { results.push(`PROBE ${m}`); console.log(`PROBE ${m}`); };
  const fail = (m: string) => { results.push(`FAIL  ${m}`); console.error(`FAIL  ${m}`); process.exitCode = 1; };

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Login as the demo gifter via the API (cookie lands in the context) —
  // the established pattern from ui-smoke-playwright.ts.
  const login = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "jay@dunphyfamily.com", password: "dunphyfamily" },
  });
  if (login.status() !== 200) {
    throw new Error(`login failed: ${login.status()} ${await login.text()}`);
  }

  const page = await context.newPage();
  await page.goto(`${baseUrl}/gifter`, { waitUntil: "domcontentloaded", timeout: 30000 });

  // 1. Hero renders with the avatar button.
  const avatarBtn = page.getByTestId("button-gifter-avatar");
  await avatarBtn.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(900); // let the hero count-ups settle for the screenshot
  await page.screenshot({ path: shot("1-hero-monogram.png"), fullPage: false });
  const heroText = await page.getByTestId("gifter-hero").innerText();
  if (!/Welcome back, Jay/.test(heroText)) fail(`hero text unexpected: ${heroText.slice(0, 120)}`);
  else ok("hero shows 'Welcome back, Jay.' with avatar button");

  // Pre-state: if Jay somehow already has a photo, remove it first so the
  // monogram path is exercised deterministically.
  const hasImg = (await avatarBtn.locator("img").count()) > 0;
  if (hasImg) {
    await avatarBtn.click();
    await page.getByTestId("button-gifter-avatar-remove").click();
    await page.waitForTimeout(800);
    probe("pre-state had a photo; removed to start clean");
  }

  // 2. No photo → tapping opens the FILE PICKER directly (no menu).
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 5000 });
  await avatarBtn.click();
  const chooser = await chooserPromise;
  ok("tap with no photo opens the file picker directly");

  // 3. Upload the generated photo.
  await chooser.setFiles({ name: "jay.png", mimeType: "image/png", buffer: RED_DOT_PNG });
  await avatarBtn.locator("img").waitFor({ state: "visible", timeout: 10000 });
  ok("avatar shows the uploaded photo");
  await page.screenshot({ path: shot("2-hero-photo.png") });

  // 4. Propagation: as PHIL (the parent), Luke's dashboard-summary should
  //    now enrich Jay's gift rows with gifterAvatarUrl.
  const philCtx = await browser.newContext();
  const philLogin = await philCtx.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "phil@dunphyfamily.com", password: "dunphyfamily" },
  });
  if (philLogin.status() !== 200) fail(`phil login failed: ${philLogin.status()}`);
  const fundsRes = await philCtx.request.get(`${baseUrl}/api/funds`);
  const fundsJson = await fundsRes.json();
  const luke = (Array.isArray(fundsJson) ? fundsJson : fundsJson?.funds || []).find(
    (f: any) => /luke/i.test(String(f.recipientFirstName || f.name || "")),
  );
  if (!luke) {
    fail("could not find Luke's fund as Phil");
  } else {
    const summaryRes = await philCtx.request.get(`${baseUrl}/api/funds/${luke.id}/dashboard-summary`);
    const summary = await summaryRes.json();
    const jayGift = (summary?.gifts || []).find((g: any) => /jay@dunphyfamily/i.test(String(g.senderEmail || "")));
    if (!jayGift) fail("no Jay gift row found on Luke's summary");
    else if (jayGift.gifterAvatarUrl && String(jayGift.gifterAvatarUrl).startsWith("data:image/")) {
      ok("PROPAGATION: Jay's gift rows on Luke's fund now carry gifterAvatarUrl (roster + snapshot will render his face)");
    } else {
      fail(`Jay gift row has no gifterAvatarUrl after upload (got: ${String(jayGift.gifterAvatarUrl).slice(0, 40)})`);
    }
  }
  await philCtx.close();

  // 5. With a photo, tapping opens the Change/Remove menu with the caption.
  await avatarBtn.click();
  const menuCaption = page.getByText("Families see this photo beside your gifts.");
  await menuCaption.waitFor({ state: "visible", timeout: 5000 });
  ok("menu opens with the loop-closing caption");
  await page.screenshot({ path: shot("3-menu-open.png") });

  // 6. PROBE: click outside closes the menu without changes.
  await page.mouse.click(900, 700);
  await page.waitForTimeout(400);
  if (await menuCaption.isVisible().catch(() => false)) fail("menu did not close on outside click");
  else probe("outside click closes the menu");

  // 7. PROBE: non-image file is rejected client-side with a toast.
  await avatarBtn.click();
  const chooser2Promise = page.waitForEvent("filechooser", { timeout: 5000 });
  await page.getByTestId("button-gifter-avatar-change").click();
  const chooser2 = await chooser2Promise;
  await chooser2.setFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
  const badToast = page.getByText("That's not an image");
  await badToast.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await badToast.isVisible().catch(() => false)) probe("non-image file rejected with a clear toast");
  else fail("no rejection toast for a non-image file");
  // Photo should be unchanged.
  if ((await avatarBtn.locator("img").count()) > 0) probe("photo unchanged after rejected upload");
  else fail("photo was lost after a rejected upload");

  // 8. Remove the photo (also restores the demo to its clean state).
  await page.waitForTimeout(1200); // let the toast clear
  await avatarBtn.click();
  await page.getByTestId("button-gifter-avatar-remove").click();
  await page.waitForTimeout(1000);
  if ((await avatarBtn.locator("img").count()) === 0) ok("Remove photo returns the avatar to the monogram (demo left clean)");
  else fail("photo still present after Remove");
  await page.screenshot({ path: shot("4-after-remove.png") });

  await browser.close();
  console.log(`\nScreenshots: ${outDir}`);
  console.log(results.join("\n"));
}

main().catch((err) => {
  console.error("VERIFY SCRIPT ERROR:", err);
  process.exit(1);
});
