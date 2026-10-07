import { expect, test, type Page } from "@playwright/test";

const email = () => `user${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

async function register(page: Page, name: string, mail: string, password = "password1") {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(mail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

test.describe("authentication", () => {
  test("register signs the user in, survives a reload, and logout works", async ({ page }) => {
    await register(page, "Ayesha Khan", email());
    await expect(page).toHaveURL("/");
    const menu = page.getByRole("button", { name: /Ayesha/ });
    await expect(menu).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: /Ayesha/ })).toBeVisible();

    await page.getByRole("button", { name: /Ayesha/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("register form validates before sending", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your name")).toBeVisible();
    await expect(page.getByText("Enter your email address")).toBeVisible();
    await expect(page.getByText("Choose a password")).toBeVisible();

    await page.getByLabel("Full name").fill("Al");
    await page.getByLabel("Email").fill("bad-email");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
  });

  test("registering an existing email shows an error and a login link", async ({ page }) => {
    const mail = email();
    await register(page, "First User", mail);
    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: /First/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();

    await register(page, "Second User", mail);
    await expect(page.getByText("An account with this email already exists")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in instead" })).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("login: wrong password shows an error, correct password signs in", async ({ page }) => {
    const mail = email();
    await register(page, "Omar Raza", mail);
    await page.getByRole("button", { name: /Omar/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();

    await page.goto("/login");
    await page.getByLabel("Email").fill(mail);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Password", { exact: true }).fill("password1");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: /Omar/ })).toBeVisible();
  });

  test("demo account logs in with one click and shows the unread notification badge", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /try the demo account/i }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: /Demo/ })).toBeVisible();
    await expect(page.getByTestId("unread-badge")).toHaveText("1");
  });

  test("an external ?next= target is ignored after login", async ({ page }) => {
    await page.goto("/login?next=https://evil.example/phish");
    await page.getByRole("button", { name: /try the demo account/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("the session cookie is httpOnly (not readable from page scripts)", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /try the demo account/i }).click();
    await expect(page).toHaveURL("/");
    expect(await page.evaluate(() => document.cookie)).not.toContain("token=");
    const cookie = (await context.cookies()).find((c) => c.name === "token");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  test("API errors surface when the backend is unreachable", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => route.abort("failed"));
    await page.goto("/login");
    await page.getByLabel("Email").fill("a@b.co");
    await page.getByLabel("Password", { exact: true }).fill("whatever1");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Cannot reach the server" })).toBeVisible();
  });
});
