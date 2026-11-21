import { expect, test } from "@playwright/test";

test.describe("landing & pricing", () => {
  test("hero, live demo and pricing tiers render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("sees every rep");
    await expect(page.getByText("LIVE DEMO")).toBeVisible();
    await expect(page.getByTestId("tier-free")).toContainText("$0");
    await expect(page.getByTestId("tier-pro")).toContainText("$9.99");
  });

  test("yearly toggle and demo Pro activation", async ({ page }) => {
    await page.goto("/pricing");
    await page.getByRole("switch", { name: "Toggle yearly billing" }).click();
    await expect(page.getByTestId("tier-pro")).toContainText("$79");
    await page.getByTestId("pro-toggle").click();
    await expect(page.getByTestId("pro-toggle")).toContainText("Pro active");
  });
});

test.describe("workout in demo mode", () => {
  test("counts reps, coaches form, saves the session to the dashboard", async ({ page }) => {
    await page.goto("/workout?demo=1&speed=3");
    await page.getByTestId("exercise-squat").click();
    await expect(page.getByTestId("source-demo")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("start-btn").click();

    await expect(page.getByTestId("mode-chip")).toContainText("Demo mode");
    await expect(page.getByTestId("pose-canvas")).toBeVisible();
    // Synthetic athlete: 2.2 s per rep at 3x speed → several reps within a few seconds.
    await expect
      .poll(async () => Number(await page.getByTestId("rep-count").textContent()), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(4);
    await expect(page.getByTestId("feedback")).toBeVisible();
    // The scripted 4th rep is shallow → the counter asks the user to go lower.
    await expect(page.getByTestId("feedback")).toContainText(/Go lower|Good rep|push back up|Keep your chest up|Ready/);
    await expect(page.getByTestId("timer")).not.toHaveText("00:00");

    await page.getByTestId("finish-btn").click();
    const summary = page.getByTestId("summary");
    await expect(summary).toBeVisible();
    const reps = Number(await page.getByTestId("summary-reps").textContent());
    expect(reps).toBeGreaterThanOrEqual(4);

    await page.getByTestId("to-dashboard").click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("history-table").locator("tbody tr")).toHaveCount(1);
    await expect(page.getByTestId("kpi-reps")).toHaveText(String(reps));
    await expect(page.getByTestId("kpi-streak")).toContainText("1");
  });
});

for (const ex of ["pushup", "curl"] as const) {
  test(`demo mode tracks ${ex} reps`, async ({ page }) => {
    await page.goto(`/workout?demo=1&speed=4&exercise=${ex}`);
    await expect(page.getByTestId(`exercise-${ex}`)).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("start-btn").click();
    await expect
      .poll(async () => Number(await page.getByTestId("rep-count").textContent()), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(2);
  });
}

test("falls back to demo mode when no camera is available", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: () => Promise.reject(new Error("No camera found")) },
    });
  });
  await page.goto("/workout");
  await expect(page.getByTestId("source-camera")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("start-btn").click();
  await expect(page.getByRole("status")).toContainText("Camera unavailable");
  await expect(page.getByTestId("mode-chip")).toContainText("Demo mode");
});

test.describe("dashboard", () => {
  test("sample data populates stats and streaks", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("history-empty")).toBeVisible();
    await page.getByTestId("seed-btn").click();
    await expect(page.getByTestId("history-table")).toBeVisible();
    await expect(page.getByTestId("kpi-streak")).toContainText("6");
    // Free plan hides sessions older than 7 days.
    await expect(page.getByText(/older sessions? hidden on the Free plan/)).toBeVisible();
  });
});

test.describe("AI weekly plan", () => {
  test("generates a 7-day plan in demo mode", async ({ page }) => {
    await page.goto("/plan");
    await page.getByRole("button", { name: "Lose weight" }).click();
    await page.getByLabel("Experience").selectOption("intermediate");
    await page.getByTestId("generate-btn").click();
    await expect(page.getByTestId("plan-result")).toBeVisible();
    await expect(page.getByTestId("plan-source")).toContainText("Demo plan");
    await expect(page.getByTestId("plan-day")).toHaveCount(7);
    await expect(page.getByTestId("plan-title")).toContainText("Lose weight");
    await expect(page.getByRole("link", { name: /TRACK/ }).first()).toBeVisible();
  });

  test("API validates input and reports demo mode", async ({ request }) => {
    const bad = await request.post("/api/plan", { data: { goal: "fly" } });
    expect(bad.status()).toBe(400);
    const mode = await request.get("/api/plan");
    expect(await mode.json()).toEqual({ mode: "demo" });
    const ok = await request.post("/api/plan", {
      data: { goal: "endurance", level: "advanced", daysPerWeek: 5, minutesPerSession: 40 },
    });
    expect(ok.ok()).toBe(true);
    const body = await ok.json();
    expect(body.mode).toBe("demo");
    expect(body.plan.days).toHaveLength(7);
    expect(body.plan.days.filter((d: { rest: boolean }) => !d.rest)).toHaveLength(5);
  });
});
