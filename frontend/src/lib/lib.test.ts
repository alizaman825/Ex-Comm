import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, buildUrl, errorMessage } from "./api";
import { discountPercent, formatPercent, formatPrice, formatUsd, safeNext, timeAgo } from "./format";
import { passwordStrength, validateEmail, validateName, validateNewPassword } from "./validation";

describe("format", () => {
  it("formats prices in PKR with thousands separators", () => {
    expect(formatPrice(129999)).toBe("Rs 129,999");
    expect(formatPrice(499.6)).toBe("Rs 500");
    expect(formatPrice(null)).toBe("–");
    expect(formatPrice(undefined)).toBe("–");
  });

  it("formats USD and percentages", () => {
    expect(formatUsd(12.5)).toBe("$12.50");
    expect(formatPercent(-4.24)).toBe("-4.2%");
    expect(formatPercent(3)).toBe("+3%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("computes discounts only when the original price is higher", () => {
    expect(discountPercent(75, 100)).toBe(25);
    expect(discountPercent(100, 100)).toBe(0);
    expect(discountPercent(100, null)).toBe(0);
  });

  it("describes elapsed time", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    expect(timeAgo("2026-10-07T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-10-07T11:30:00Z", now)).toBe("30 minutes ago");
    expect(timeAgo("2026-10-07T11:00:00Z", now)).toBe("1 hour ago");
    expect(timeAgo("2026-10-05T12:00:00Z", now)).toBe("2 days ago");
    expect(timeAgo(null, now)).toBe("never");
  });

  it("only allows same-site redirects after login", () => {
    expect(safeNext("/wishlist")).toBe("/wishlist");
    expect(safeNext("/search?q=a")).toBe("/search?q=a");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("javascript:alert(1)", "/home")).toBe("/home");
  });
});

describe("validation", () => {
  it("validates email", () => {
    expect(validateEmail("")).toBe("Enter your email address");
    expect(validateEmail("nope")).toBe("Enter a valid email address");
    expect(validateEmail("a@b")).toBe("Enter a valid email address");
    expect(validateEmail(" ali@example.com ")).toBeUndefined();
  });

  it("validates name and password", () => {
    expect(validateName("")).toBeTruthy();
    expect(validateName("A")).toBe("Name must be at least 2 characters");
    expect(validateName("Al")).toBeUndefined();
    expect(validateNewPassword("")).toBeTruthy();
    expect(validateNewPassword("short")).toBe("Password must be at least 8 characters");
    expect(validateNewPassword("longenough")).toBeUndefined();
  });

  it("rates password strength", () => {
    expect(passwordStrength("abc").label).toBe("Too short");
    expect(passwordStrength("abcdefgh").label).toBe("Weak");
    expect(passwordStrength("Abcdefg1").label).toBe("Good");
    expect(passwordStrength("Abcdefg1!xyz").label).toBe("Strong");
  });
});

describe("api client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds URLs and skips empty params", () => {
    expect(buildUrl("/search", { q: "air fryer", page: 2, platform: ["daraz", "priceoye"], minPrice: undefined, sort: "" })).toBe(
      "/api/search?q=air+fryer&page=2&platform=daraz%2Cpriceoye"
    );
    expect(buildUrl("/health")).toBe("/api/health");
  });

  it("returns parsed JSON and sends JSON bodies with cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/auth/login", { method: "POST", body: { a: 1 } })).resolves.toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("maps API error responses to ApiError with field details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Enter a valid email address", details: [{ field: "email", message: "Enter a valid email address" }] } }), { status: 400 })
      )
    );
    const err = (await api("/auth/register", { method: "POST", body: {} }).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.fieldError("email")).toBe("Enter a valid email address");
    expect(err.fieldError("name")).toBeUndefined();
  });

  it("handles 204 and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api("/auth/logout", { method: "POST" })).resolves.toBeUndefined();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = (await api("/health").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(errorMessage(err)).toMatch(/Cannot reach the server/);
  });

  it("falls back to a generic message for non-JSON errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 })));
    const err = (await api("/health").catch((e) => e)) as ApiError;
    expect(err.message).toBe("Request failed (502)");
  });
});
