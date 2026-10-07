import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SearchResponse } from "@/lib/types";
import { SourceBanner, bannerMessage } from "./SourceBanner";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const response = (over: Partial<SearchResponse>): SearchResponse => ({
  query: "iphone",
  source: "live",
  fetchedAt: ago(0),
  platformStatus: { daraz: { status: "success", relevant: 12 }, priceoye: { status: "failed" } },
  total: 12,
  page: 1,
  pages: 1,
  pageSize: 12,
  results: [],
  ...over,
});

describe("SourceBanner wording", () => {
  it("says results came live from the stores, and when", () => {
    expect(bannerMessage(response({ source: "live", fetchedAt: ago(0) }))).toMatch(/^Live results from the stores, checked just now/);
    const cached = bannerMessage(response({ source: "cache", fetchedAt: ago(27) }));
    expect(cached).toContain("Live results from the stores, checked 27 minutes ago");
    expect(cached).toContain("refresh to check the stores again");
  });

  it("is honest when the stores could not be reached, and in demo mode", () => {
    expect(bannerMessage(response({ source: "fallback" }))).toMatch(/could not be reached/);
    expect(bannerMessage(response({ source: "fallback", demoMode: true }))).toMatch(/Demo mode.*saved sample data/);
  });
});

describe("SourceBanner refresh button", () => {
  it("offers a refresh for live and earlier results and calls the handler", async () => {
    const onRefresh = vi.fn();
    render(<SourceBanner data={response({ source: "cache", fetchedAt: ago(27) })} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh from stores" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows progress and disables the button while the stores are being checked", () => {
    render(<SourceBanner data={response({ source: "cache" })} onRefresh={() => {}} refreshing />);
    const btn = screen.getByRole("button", { name: "Checking the stores…" });
    expect(btn).toBeDisabled();
  });

  it("offers 'Try the stores again' when the last attempt failed", () => {
    render(<SourceBanner data={response({ source: "fallback" })} onRefresh={() => {}} />);
    expect(screen.getByRole("button", { name: "Try the stores again" })).toBeInTheDocument();
  });

  it("has no refresh button in demo mode, where scraping is off", () => {
    render(<SourceBanner data={response({ source: "fallback", demoMode: true })} onRefresh={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists per-store status for live results", () => {
    render(<SourceBanner data={response({ source: "live" })} onRefresh={() => {}} />);
    const list = screen.getByRole("list", { name: "Store status" });
    expect(list).toHaveTextContent("Daraz");
    expect(list).toHaveTextContent("12 found");
    expect(list).toHaveTextContent("PriceOye");
    expect(list).toHaveTextContent("unavailable");
  });
});
