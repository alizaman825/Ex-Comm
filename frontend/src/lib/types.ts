// Shapes returned by the Ex-Comm API (see docs/PLAN.md section 4).

export type Platform = "daraz" | "priceoye" | "aliexpress";
export type DataSource = "live" | "saved";
export type SearchSource = "live" | "cache" | "fallback";

export interface User {
  id: string;
  name: string;
  email: string;
  emailAlerts: boolean;
  createdAt: string;
}

export interface Offer {
  listingId: string;
  platform: Platform;
  role: "retail" | "supplier";
  price: number;
  priceUsd: number | null;
  originalPrice: number | null;
  rating: number | null;
  reviewCount: number;
  inStock: boolean;
  url: string;
  dataSource: DataSource;
  lastScrapedAt: string | null;
}

export interface ProductCard {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  minPrice: number;
  maxPrice: number;
  rating: number | null;
  reviewCount: number;
  priceChange7d: number;
  platforms: Platform[];
  offers: Offer[];
}

export interface Listing {
  id: string;
  platform: Platform;
  role: "retail" | "supplier";
  title: string;
  url: string;
  image: string | null;
  price: number;
  priceUsd: number | null;
  originalPrice: number | null;
  discountPct: number;
  currency: string;
  rating: number | null;
  reviewCount: number;
  inStock: boolean;
  dataSource: DataSource;
  lastScrapedAt: string | null;
}

export interface ProductDetail extends ProductCard {
  retailMinPrice: number | null;
  supplierMinPrice: number | null;
  listings: Listing[];
  inWishlist?: boolean;
  activeAlerts?: number;
}

export interface PlatformStatus {
  status: "success" | "failed" | "skipped";
  scraped?: number;
  relevant?: number;
  ms?: number;
  error?: string;
  saved?: boolean;
}

export interface SearchResponse {
  query: string;
  source: SearchSource;
  fetchedAt: string | null;
  platformStatus: Partial<Record<Platform, PlatformStatus>>;
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  results: ProductCard[];
}

export interface Category {
  slug: string;
  name: string;
  icon: string;
  keywords: string[];
  productCount: number;
}

export interface TrendingSearch {
  query: string;
  hits: number;
  results: number;
}

export interface HistoryPoint {
  date: string;
  price: number;
}

export interface HistorySeries {
  platform: Platform;
  role: "retail" | "supplier";
  points: HistoryPoint[];
}

export interface HistoryResponse {
  productId: string;
  days: number;
  series: HistorySeries[];
  overall: HistoryPoint[];
  summary: {
    current: number;
    lowest: number;
    lowestDate: string;
    highest: number;
    average: number;
    changePct: number;
  } | null;
}

export interface CompareResponse {
  mode: "platforms" | "products";
  products: (ProductCard & { listings: Listing[] })[];
  cheapest: { productId: string; listingId: string; platform: Platform; price: number } | null;
  bestRated: { productId: string; listingId: string; platform: Platform; rating: number } | null;
}

export interface WishlistItem {
  id: string;
  addedAt: string;
  priceWhenAdded: number | null;
  changeSinceAdded: number;
  product: ProductCard;
}

export interface AlertItem {
  id: string;
  type: "price" | "supplier_drop" | "margin";
  targetPrice: number | null;
  targetMargin: number | null;
  platform: Platform | null;
  active: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  product: { id: string; title: string; image: string | null; minPrice: number };
  currentPrice: number | null;
  currentPlatform: Platform | null;
  reached: boolean;
}

export interface NotificationItem {
  id: string;
  message: string;
  price: number | null;
  platform: Platform | null;
  read: boolean;
  createdAt: string;
  alertId: string | null;
  product: { id: string; title: string; image: string | null } | null;
}

export interface NotificationsResponse {
  total: number;
  page: number;
  pages: number;
  unreadCount: number;
  notifications: NotificationItem[];
}
