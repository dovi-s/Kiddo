/* eslint-disable no-console */
// Focused capture of the de-crammed toast cards at rest (default card with
// description, and the destructive card). One-off, not part of the suite.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:5000";
const outDir = path.join(process.cwd(), "artifacts", "verify-toast");
mkdirSync(outDir, { recursive: true });

const RED_DOT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAKklEQVR42mP8z8Dwn4ECwDiqYdSAUQNGDRg1YNSAUQNGDRg1YNSAkWYAAJSkKfH/Cv9tAAAAAElFTkSuQmCC",
  "base64",
);

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const login = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: "robert@riverafamily.com", password: "riverafamily" },
  });
  if (login.status() !== 200) throw new Error(`login failed: ${login.status()}`);

  const page = await context.newPage();
  await page.goto(`${baseUrl}/gifter`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const avatarBtn = page.getByTestId("button-gifter-avatar");
  await avatarBtn.waitFor({ state: "visible", timeout: 20000 });

  // 1. Default card toast (title + description): "Photo updated".
  const chooserP = page.waitForEvent("filechooser", { timeout: 5000 });
  await avatarBtn.click();
  const chooser = await chooserP;
  await chooser.setFiles({ name: "jay.png", mimeType: "image/png", buffer: RED_DOT_PNG });
  const toastCard = page.locator('[role="status"], li[data-state="open"]').filter({ hasText: "Photo updated" }).first();
  await toastCard.waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(700); // let the slide-in fully settle
  await page.screenshot({ path: path.join(outDir, "toast-default-context.png"), clip: { x: 240, y: 0, width: 800, height: 140 } });
  await toastCard.screenshot({ path: path.join(outDir, "toast-default.png") });
  console.log("captured default card toast");

  // Wait out the toast, then trigger the destructive one via a bad upload.
  await page.waitForTimeout(5200);
  await avatarBtn.click();
  const chooser2P = page.waitForEvent("filechooser", { timeout: 5000 });
  await page.getByTestId("button-gifter-avatar-change").click();
  const chooser2 = await chooser2P;
  await chooser2.setFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  const badToast = page.locator('li[data-state="open"]').filter({ hasText: "That's not an image" }).first();
  await badToast.waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(700);
  await badToast.screenshot({ path: path.join(outDir, "toast-destructive.png") });
  console.log("captured destructive card toast");

  // Clean up: remove the photo so the demo stays pristine.
  await page.waitForTimeout(5200);
  await avatarBtn.click();
  await page.getByTestId("button-gifter-avatar-remove").click();
  await page.waitForTimeout(900);
  console.log("demo restored (photo removed)");

  await browser.close();
  console.log(`Screenshots: ${outDir}`);
}

main().catch((err) => { console.error("VERIFY SCRIPT ERROR:", err); process.exit(1); });
