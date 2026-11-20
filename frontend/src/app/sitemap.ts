import type { MetadataRoute } from "next";
import type { ProductCard } from "@/lib/types";

const siteUrl = process.env.SITE_URL || "https://ex-comm.vercel.app";
const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");

const STATIC_PATHS = ["", "/search", "/categories", "/compare", "/best-deals", "/about"];

/** Real, live product URLs only (AUDIT.md §4j / PLAN.md Phase 1 "bonus" item) - no fabricated or
 * placeholder entries. Best-effort: a trending-products fetch failure still returns the static pages
 * rather than failing the whole sitemap. */
async function productUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${backendUrl}/api/products/trending?limit=30`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: ProductCard[] };
    return (data.products ?? []).map((p) => ({ url: `${siteUrl}/products/${p.id}`, changeFrequency: "daily" as const, priority: 0.7 }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.8,
  }));
  return [...staticEntries, ...(await productUrls())];
}
