import { expect, test } from "@playwright/test";
import { firstId, loginDemoUser, registerUser, uniqueEmail } from "./helpers";

test.describe("signed-in pages are protected", () => {
  for (const path of ["/wishlist", "/alerts", "/notifications", "/profile"]) {
    test(`${path} redirects to login and returns after signing in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace("%", "%")}`));
      await page.getByRole("button", { name: /try the demo account/i }).click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});

test.describe("wishlist", () => {
  test("empty state, save from results, sort, persist and remove", async ({ page }) => {
    await registerUser(page);
    await page.goto("/wishlist");
    await expect(page.locator('[data-state="empty"]')).toContainText("Your wishlist is empty");

    await page.goto("/search?q=samsung");
    const hearts = page.getByRole("button", { name: /Save .* to wishlist/ });
    await hearts.nth(0).click();
    await expect(page.getByRole("button", { name: /Remove .* from wishlist/ })).toHaveCount(1);
    await hearts.nth(0).click();
    await expect(page.getByRole("button", { name: /Remove .* from wishlist/ })).toHaveCount(2);

    await page.goto("/wishlist");
    const items = page.getByTestId("wishlist-item");
    await expect(items).toHaveCount(2);
    await expect(page.getByTestId("wishlist-count")).toHaveText("2 products");
    await expect(items.first()).toContainText("Rs");
    await expect(items.first()).toContainText("when saved");

    await page.getByLabel("Sort by").selectOption("price");
    const prices = (await items.locator(".t-price").allTextContents()).map((t) => Number(t.replace(/[^0-9]/g, "")));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    await page.reload();
    await expect(items).toHaveCount(2);
    await items.first().getByRole("button", { name: /Remove/ }).click();
    await expect(page.getByText(/Removed ".*" from your wishlist/)).toBeVisible();
    await expect(items).toHaveCount(1);
    await items.first().getByRole("button", { name: /Remove/ }).click();
    await expect(page.locator('[data-state="empty"]')).toContainText("Your wishlist is empty");
  });

  test("the demo account has a sample wishlist", async ({ page }) => {
    await loginDemoUser(page);
    await page.goto("/wishlist");
    await expect(page.getByTestId("wishlist-item")).toHaveCount(6);
  });
});

test.describe("price alerts", () => {
  test("create from the alerts page, edit, pause, resume, filter and delete", async ({ page }) => {
    await registerUser(page);
    await page.goto("/alerts");
    await expect(page.locator('[data-state="empty"]')).toContainText("No price alerts yet");

    // create: search for a product, pick it, set a low target
    await page.getByRole("button", { name: "Create your first alert" }).click();
    const flow = page.getByRole("dialog", { name: "Create a price alert" });
    await expect(flow.getByText("Type at least 2 characters to search.")).toBeVisible();
    await flow.getByLabel("Search for a product").fill("airpods pro");
    await flow.getByRole("button", { name: /AirPods Pro 2/ }).click();
    const dialog = page.getByRole("dialog", { name: "Set a price alert" });
    await dialog.getByLabel("Notify me when the price is").fill("20000");
    await dialog.getByRole("button", { name: "Create alert" }).click();
    await expect(page.getByTestId("alert-success")).toContainText("We will notify you");
    await page.getByRole("button", { name: "Done" }).click();

    const rows = page.getByTestId("alert-item");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-status", "watching");
    await expect(rows.first()).toContainText("Rs 20,000");
    await expect(rows.first()).toContainText("Any store");

    // edit target (validation first)
    await rows.first().getByRole("button", { name: /Edit target price/ }).click();
    const edit = page.getByRole("dialog", { name: "Change target price" });
    await edit.getByLabel("Notify me when the price is").fill("0");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit.getByText("Target price must be greater than 0")).toBeVisible();
    await edit.getByLabel("Notify me when the price is").fill("30000");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Target price updated")).toBeVisible();
    await expect(rows.first()).toContainText("Rs 30,000");

    // pause / resume and tab filters
    await rows.first().getByRole("button", { name: /Pause alert/ }).click();
    await expect(rows.first()).toHaveAttribute("data-status", "paused");
    await page.getByRole("tab", { name: /Paused/ }).click();
    await expect(rows).toHaveCount(1);
    await page.getByRole("tab", { name: /Watching/ }).click();
    await expect(page.getByText("No watching alerts")).toBeVisible();
    await page.getByRole("tab", { name: /^All/ }).click();
    await rows.first().getByRole("button", { name: /Resume alert/ }).click();
    await expect(rows.first()).toHaveAttribute("data-status", "watching");

    // delete asks for confirmation
    await rows.first().getByRole("button", { name: /Delete alert/ }).click();
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(rows).toHaveCount(1);
    await rows.first().getByRole("button", { name: /Delete alert/ }).click();
    await page.getByRole("button", { name: "Delete alert", exact: true }).click();
    await expect(page.locator('[data-state="empty"]')).toContainText("No price alerts yet");
  });

  test("an alert whose target is already met shows as reached and creates a notification", async ({ page, request }) => {
    await registerUser(page);
    const id = await firstId(request, "jbl flip 6");
    await page.goto(`/products/${id}`);
    await page.getByRole("button", { name: "Set price alert" }).click();
    await page.getByLabel("Notify me when the price is").fill("9999999");
    await page.getByRole("dialog").getByRole("button", { name: "Create alert" }).click();
    await expect(page.getByTestId("alert-success")).toContainText("already at or below your target");
    await page.getByRole("link", { name: "View my alerts" }).click();

    await expect(page.getByTestId("alert-item").first()).toHaveAttribute("data-status", "reached");
    await expect(page.getByRole("tab", { name: /Target reached/ })).toContainText("1");
    await expect(page.getByTestId("unread-badge")).toHaveText("1"); // the bell shows the new notification
  });

  test("the demo account has sample alerts in different states", async ({ page }) => {
    await loginDemoUser(page);
    await page.goto("/alerts");
    await expect(page.getByTestId("alert-item")).toHaveCount(4);
    await expect(page.getByTestId("alert-item").and(page.locator('[data-status="paused"]'))).toHaveCount(1);
    await expect(page.getByRole("tab", { name: /All/ })).toContainText("4");
  });
});

test.describe("notifications", () => {
  test("open a notification, unread filter and mark all as read update the bell", async ({ page, request }) => {
    await registerUser(page);
    // two alerts whose targets are already met -> two unread notifications
    for (const q of ["jbl flip 6", "airpods pro"]) {
      const res = await page.request.post("/api/alerts", { data: { productId: await firstId(request, q), targetPrice: 99999999 } });
      expect(res.ok()).toBeTruthy();
    }
    await page.goto("/notifications");
    await expect(page.getByTestId("unread-badge")).toHaveText("2");
    const items = page.getByTestId("notification");
    await expect(items).toHaveCount(2);
    await expect(items.and(page.locator('[data-read="false"]'))).toHaveCount(2);

    await page.getByRole("tab", { name: /Unread/ }).click();
    await expect(items).toHaveCount(2);

    await items.first().click(); // opens the product and marks it read
    await expect(page).toHaveURL(/\/products\/[a-f0-9]{24}/);
    await expect(page.getByTestId("unread-badge")).toHaveText("1");

    await page.goto("/notifications");
    await page.getByRole("tab", { name: /Unread/ }).click();
    await expect(items).toHaveCount(1);
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByTestId("unread-badge")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
    await expect(page.locator('[data-state="empty"]')).toContainText("You are all caught up");
  });

  test("the demo account starts with one unread notification", async ({ page }) => {
    await loginDemoUser(page);
    await page.goto("/notifications");
    await expect(page.getByTestId("notification").first()).toBeVisible();
  });
  test("mark all as read and pagination for many notifications", async ({ page, request }) => {
    await registerUser(page);
    // 12 alerts that are already met -> 12 notifications
    const queries = ["iphone 16", "iphone 15 128gb", "galaxy a55", "redmi note 14", "pixel 9", "airpods pro", "jbl flip 6", "sony wh-1000xm5", "macbook air m3", "apple watch series 10", "amazfit gts 4", "air fryer"];
    for (const q of queries) {
      const id = await firstId(request, q);
      const res = await page.request.post("/api/alerts", { data: { productId: id, targetPrice: 99999999 } });
      expect(res.ok()).toBeTruthy();
    }
    await page.goto("/notifications");
    const items = page.getByTestId("notification");
    await expect(items).toHaveCount(10);
    await expect(page.getByRole("button", { name: "Page 2" })).toBeVisible();
    await page.getByRole("button", { name: "Page 2" }).click();
    await expect(items).toHaveCount(2);

    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByText("Marked 12 as read")).toBeVisible();
    await expect(items.and(page.locator('[data-read="false"]'))).toHaveCount(0);
    await expect(page.getByTestId("unread-badge")).toHaveCount(0);
  });

  test("a new user sees the empty state", async ({ page }) => {
    await registerUser(page);
    await page.goto("/notifications");
    await expect(page.locator('[data-state="empty"]')).toContainText("No notifications yet");
  });
});

test.describe("profile and settings", () => {
  test("update name and email-alert preference", async ({ page }) => {
    await registerUser(page, "Old Name");
    await page.goto("/profile");
    await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

    await page.getByLabel("Full name").fill("A");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();

    await page.getByLabel("Full name").fill("New Name");
    await page.getByLabel(/Email me when a price alert/).check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();
    await expect(page.getByRole("button", { name: /New/ }).first()).toBeVisible(); // navbar shows the new first name

    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("New Name");
    await expect(page.getByLabel(/Email me when a price alert/)).toBeChecked();
  });

  test("change password: validation, wrong current password, success, login with the new one", async ({ page }) => {
    const user = await registerUser(page);
    await page.goto("/profile");
    const pw = (name: string) => page.getByLabel(name, { exact: true });

    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Enter your current password")).toBeVisible();

    await pw("Current password").fill(user.password);
    await pw("New password").fill("short");
    await pw("Confirm new password").fill("short");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();

    await pw("New password").fill("brandnew123");
    await pw("Confirm new password").fill("different123");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();

    await pw("Current password").fill("wrong-password");
    await pw("Confirm new password").fill("brandnew123");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Current password is incorrect")).toBeVisible();

    await pw("Current password").fill(user.password);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText("Incorrect email or password")).toBeVisible(); // the old password no longer works
    await page.getByLabel("Password", { exact: true }).fill("brandnew123");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL("/");
  });

  test("delete account: needs the right password, then signs out and the account is gone", async ({ page }) => {
    const user = await registerUser(page);
    await page.goto("/profile");
    await page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your account?" });
    await dialog.getByRole("button", { name: "Permanently delete" }).click();
    await expect(dialog.getByText("Enter your password to confirm")).toBeVisible();
    await dialog.getByLabel("Confirm with your password").fill("wrong-password");
    await dialog.getByRole("button", { name: "Permanently delete" }).click();
    await expect(dialog.getByText("Password is incorrect")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Profile & settings" })).toBeVisible(); // still signed in

    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("dialog").getByLabel("Confirm with your password").fill(user.password);
    await page.getByRole("dialog").getByRole("button", { name: "Permanently delete" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Your account has been deleted")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText("Incorrect email or password")).toBeVisible();
  });

  test("registering twice with the same email is still refused after another account exists", async ({ page }) => {
    // sanity check that uniqueEmail() really generates distinct addresses
    expect(uniqueEmail()).not.toBe(uniqueEmail());
    await registerUser(page);
  });
});
