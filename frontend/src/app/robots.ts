import type { MetadataRoute } from "next";

const siteUrl = process.env.SITE_URL || "https://ex-comm.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/profile", "/alerts", "/notifications", "/wishlist"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
