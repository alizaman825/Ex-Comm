import { describe, expect, it } from "vitest";
import { activeFilterCount, parseSearchParams, priceRangeError, toSearchParams } from "./search";
import { pageWindow } from "@/components/ui/Pagination";

const parse = (qs: string) => parseSearchParams(new URLSearchParams(qs));

describe("search URL state", () => {
  it("parses a full query string", () => {
    expect(parse("q=galaxy+a55&category=mobiles&platform=daraz,priceoye&minPrice=1000&maxPrice=90000&minRating=4&sort=price_asc&page=2")).toEqual({
      q: "galaxy a55",
      category: "mobiles",
      platform: ["daraz", "priceoye"],
      minPrice: 1000,
      maxPrice: 90000,
      minRating: 4,
      sort: "price_asc",
      page: 2,
    });
  });

  it("applies defaults and ignores invalid values from a hand-edited URL", () => {
    const s = parse("platform=amazon,daraz&minPrice=abc&maxPrice=-5&minRating=9&sort=cheapest&page=0");
    expect(s).toEqual({ q: "", category: "", platform: ["daraz"], minPrice: undefined, maxPrice: undefined, minRating: undefined, sort: "relevance", page: 1 });
    expect(parse("page=2.9").page).toBe(2);
    expect(parse("page=abc").page).toBe(1);
  });

  it("round-trips and omits defaults", () => {
    const state = parse("q=air+fryer&platform=daraz&sort=rating&page=3");
    expect(toSearchParams(state).toString()).toBe("q=air+fryer&platform=daraz&sort=rating&page=3");
    expect(toSearchParams({ q: "x", sort: "relevance", page: 1, platform: [] }).toString()).toBe("q=x");
  });

  it("counts active filters (a price range counts once)", () => {
    expect(activeFilterCount(parse("q=a"))).toBe(0);
    expect(activeFilterCount(parse("category=audio&platform=daraz&minPrice=1&maxPrice=2&minRating=4"))).toBe(4);
  });

  it("detects an inverted price range", () => {
    expect(priceRangeError(500, 100)).toMatch(/Minimum price/);
    expect(priceRangeError(100, 500)).toBeUndefined();
    expect(priceRangeError(100, undefined)).toBeUndefined();
  });
});

describe("pageWindow", () => {
  it("shows all pages when there are few", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
  it("collapses distant pages with gaps", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
  });
});
