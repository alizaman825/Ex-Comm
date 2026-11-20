import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Offer, ProductCard, SearchResponse } from "@/lib/types";
import { SourceBanner, bannerMessage } from "./SourceBanner";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const offer = (over: Partial<Offer>): Offer => ({
  listingId: "l1",
  platform: "telex",
  role: "retail",
  price: 1000,
  priceUsd: null,
  originalPrice: null,
  rating: null,
  reviewCount: 0,
  inStock: true,
  url: "https://telex.pk/x",
  dataSource: "live",
  lastScrapedAt: ago(0),
  status: "checked_recently",
  condition: "unknown",
  multiVariant: false,
  ...over,
});
const product = (offers: Offer[]): ProductCard => ({
  id: "p1",
  title: "Phone",
  brand: null,
  category: null,
  image: null,
  minPrice: 1000,
  maxPrice: 1000,
  rating: null,
  reviewCount: 0,
  priceChange7d: 0,
  platforms: offers.map((o) => o.platform),
  offers,
});
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
    expect(bannerMessage(response({ source: "fallback" }))).toMatch(/could not be checked/);
    expect(bannerMessage(response({ source: "fallback", demoMode: true }))).toMatch(/Demo mode.*saved data/);
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

describe("SourceBanner store problems", () => {
  it("names the reason for each store that did not answer", () => {
    render(
      <SourceBanner
        data={response({ source: "fallback", platformStatus: { daraz: { status: "failed", code: "TIMEOUT" }, priceoye: { status: "skipped", code: "CIRCUIT_OPEN" } } })}
        onRefresh={() => {}}
      />
    );
    const list = screen.getByTestId("store-problems");
    expect(list).toHaveTextContent("Daraz took too long to answer");
    expect(list).toHaveTextContent("PriceOye is paused for a few minutes after repeated failures");
  });

  it("shows the reason for the failing store next to the counts for the one that worked", () => {
    render(<SourceBanner data={response({ source: "live", platformStatus: { daraz: { status: "success", relevant: 7 }, priceoye: { status: "failed", code: "BLOCKED" } } })} onRefresh={() => {}} />);
    expect(screen.getByRole("list", { name: "Store status" })).toHaveTextContent("7 found");
    expect(screen.getByTestId("store-problems")).toHaveTextContent("PriceOye refused the request");
  });

  it("shows no problem list when every store answered", () => {
    render(<SourceBanner data={response({ source: "live", platformStatus: { daraz: { status: "success", relevant: 2 }, priceoye: { status: "success", relevant: 0 } } })} />);
    expect(screen.queryByTestId("store-problems")).not.toBeInTheDocument();
  });
});

describe("SourceBanner store chips (live mirror)", () => {
  it("shows how many results are loaded of the store's total", () => {
    render(<SourceBanner data={response({ mode: "live", platformStatus: { daraz: { status: "success", loaded: 40, total: 4063 }, priceoye: { status: "success", loaded: 24, total: 1920, approximate: true } } })} />);
    expect(screen.getByText("40 of 4,063")).toBeInTheDocument();
    expect(screen.getByText("24 of about 1,920")).toBeInTheDocument();
  });
});

describe("SourceBanner Telex sync chip", () => {
  it("shows Telex as synced (not live), from the results, even though it's never in platformStatus", () => {
    render(<SourceBanner data={response({ source: "live", results: [product([offer({ lastScrapedAt: ago(90) })])] })} onRefresh={() => {}} />);
    const chip = screen.getByTestId("telex-sync-chip");
    expect(chip).toHaveTextContent("Telex.pk synced");
    expect(chip).toHaveTextContent("hour");
    expect(chip).not.toHaveTextContent("Live");
  });

  it("is not part of the refreshable store list and isn't disabled while refreshing", () => {
    render(<SourceBanner data={response({ source: "cache", results: [product([offer({ lastScrapedAt: ago(5) })])] })} onRefresh={() => {}} refreshing />);
    expect(screen.getByTestId("telex-sync-chip")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checking the stores…" })).toBeDisabled();
  });

  it("shows no Telex chip when nothing in the results came from Telex", () => {
    render(<SourceBanner data={response({ source: "live", results: [] })} />);
    expect(screen.queryByTestId("telex-sync-chip")).not.toBeInTheDocument();
  });

  it("shows no Telex chip in demo mode", () => {
    render(<SourceBanner data={response({ source: "fallback", demoMode: true, results: [product([offer({ lastScrapedAt: ago(5) })])] })} />);
    expect(screen.queryByTestId("telex-sync-chip")).not.toBeInTheDocument();
  });
});
