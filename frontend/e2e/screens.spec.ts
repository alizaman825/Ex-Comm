import { test } from "@playwright/test";
import { settle } from "./helpers";
import path from "node:path";

// Captures report screenshots into docs/screenshots (see docs/screenshots_checklist.md).
// Run with: npx playwright test e2e/screens.spec.ts --project=desktop
const OUT = path.resolve(__dirname, "../../docs/screenshots");
const shot = (name: string) => ({ path: path.join(OUT, `${name}.png`), fullPage: true });

test.describe("report screenshots", () => {
  test("01 login", async ({ page }) => {
    await page.goto("/login");
    await settle(page);
    await page.screenshot(shot("01-login"));
  });

  test("02 register", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Password", { exact: true }).fill("Abcdefg1!xyz");
    await settle(page);
    await page.screenshot(shot("02-register"));
  });
});
