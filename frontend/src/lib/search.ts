import type { Platform } from "./types";

export const PLATFORMS: Platform[] = ["daraz", "priceoye", "aliexpress", "ebay", "amazon"];
/** Checked on demand, not part of the default live search (see Filters' showSuppliers prop). */
export const SUPPLIER_PLATFORMS: Platform[] = ["aliexpress", "ebay", "amazon"];
export const SORTS = [
  { value: "relevance", label: "Best match" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "discount", label: "Biggest price drop" },
] as const;
export type SortValue = (typeof SORTS)[number]["value"];

export interface SearchState {
  q: string;
  category: string;
  platform: Platform[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort: SortValue;
  page: number;
  /** live search: how many results to show (Show more raises it) */
  show: number;
}

export const SHOW_STEP = 24;
export const SHOW_MAX = 400;

const num = (v: string | null): number | undefined => {
  if (v === null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** URL query -> search state (anything invalid is ignored, so a hand-edited URL never breaks the page). */
export function parseSearchParams(params: URLSearchParams): SearchState {
  const sort = params.get("sort") as SortValue | null;
  const page = Math.floor(Number(params.get("page")));
  const show = Number(params.get("show"));
  const rating = num(params.get("minRating"));
  return {
    q: (params.get("q") ?? "").trim().slice(0, 100),
    category: (params.get("category") ?? "").trim(),
    platform: (params.get("platform") ?? "")
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter((p): p is Platform => (PLATFORMS as string[]).includes(p)),
    minPrice: num(params.get("minPrice")),
    maxPrice: num(params.get("maxPrice")),
    minRating: rating !== undefined && rating <= 5 ? rating : undefined,
    sort: SORTS.some((s) => s.value === sort) ? (sort as SortValue) : "relevance",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    show: Number.isFinite(show) && show > SHOW_STEP ? Math.min(Math.floor(show), SHOW_MAX) : SHOW_STEP,
  };
}

/** Search state -> URL query (defaults are omitted to keep URLs short and shareable). */
export function toSearchParams(state: Partial<SearchState>): URLSearchParams {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.category) p.set("category", state.category);
  if (state.platform?.length) p.set("platform", state.platform.join(","));
  if (state.minPrice !== undefined) p.set("minPrice", String(state.minPrice));
  if (state.maxPrice !== undefined) p.set("maxPrice", String(state.maxPrice));
  if (state.minRating !== undefined) p.set("minRating", String(state.minRating));
  if (state.sort && state.sort !== "relevance") p.set("sort", state.sort);
  if (state.page && state.page > 1) p.set("page", String(state.page));
  if (state.show && state.show > SHOW_STEP) p.set("show", String(state.show));
  return p;
}

export function activeFilterCount(s: SearchState): number {
  return (s.category ? 1 : 0) + (s.platform.length ? 1 : 0) + (s.minPrice !== undefined || s.maxPrice !== undefined ? 1 : 0) + (s.minRating !== undefined ? 1 : 0);
}

/** Message when min > max, else undefined. */
export function priceRangeError(min?: number, max?: number): string | undefined {
  return min !== undefined && max !== undefined && min > max ? "Minimum price cannot be higher than the maximum" : undefined;
}
