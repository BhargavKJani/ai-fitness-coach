import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Generates README media into docs/. Skipped unless SHOTS=1:
 *   SHOTS=1 npx playwright test screenshots && node scripts/make-gif.mjs
 */
test.skip(!process.env.SHOTS, "set SHOTS=1 to regenerate docs/ screenshots");
test.describe.configure({ mode: "serial", timeout: 120_000 });

const DOCS = path.join(process.cwd(), "docs");
const FRAMES = path.join(DOCS, ".frames");

test("capture screenshots", async ({ page }) => {
  fs.mkdirSync(DOCS, { recursive: true });

  await page.goto("/");
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(DOCS, "landing.png") });

  await page.locator("#pricing").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator("#pricing").screenshot({ path: path.join(DOCS, "pricing.png") });

  await page.goto("/workout?demo=1");
  await page.screenshot({ path: path.join(DOCS, "workout-setup.png") });
  await page.getByTestId("start-btn").click();
  await expect.poll(async () => Number(await page.getByTestId("rep-count").textContent()), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
  // Wait for a moment mid-rep so the skeleton is visibly bent.
  await expect(page.getByTestId("phase")).toHaveText("bottom", { timeout: 10_000 });
  await page.screenshot({ path: path.join(DOCS, "workout-live.png") });

  await expect.poll(async () => Number(await page.getByTestId("rep-count").textContent()), { timeout: 20_000 }).toBeGreaterThanOrEqual(5);
  await page.getByTestId("finish-btn").click();
  await expect(page.getByTestId("summary")).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(DOCS, "summary.png") });

  // Start the dashboard from sample history (plus nothing else) for a representative screenshot.
  await page.evaluate(() => localStorage.removeItem("afc.sessions.v1"));
  await page.goto("/dashboard");
  await page.getByTestId("seed-btn").click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(DOCS, "dashboard.png"), fullPage: true });

  await page.goto("/plan");
  await page.getByTestId("generate-btn").click();
  await expect(page.getByTestId("plan-result")).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(DOCS, "plan.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DOCS, "mobile.png") });
});

test("capture demo GIF frames", async ({ page }) => {
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  await page.setViewportSize({ width: 1100, height: 640 });
  await page.goto("/workout?demo=1&exercise=squat");
  await page.getByTestId("start-btn").click();
  await expect(page.getByTestId("rep-count")).toBeVisible();
  const stage = page.locator(".lg\\:grid-cols-\\[1fr_300px\\]").first();
  const box = await stage.boundingBox();
  if (!box) throw new Error("stage not found");
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < 11_500) {
    await page.screenshot({
      path: path.join(FRAMES, `${String(i).padStart(4, "0")}.png`),
      clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 640 - box.y) },
    });
    i++;
    await page.waitForTimeout(60);
  }
  fs.writeFileSync(path.join(FRAMES, "meta.json"), JSON.stringify({ frames: i, ms: Date.now() - start }));
});
