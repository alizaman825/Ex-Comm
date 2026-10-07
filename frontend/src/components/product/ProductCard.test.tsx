import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProductCard as ProductCardData } from "@/lib/types";
import { ProductCard } from "./ProductCard";

const compare = { ids: [] as string[], has: vi.fn((id: string) => compare.ids.includes(id)), toggle: vi.fn(), remove: vi.fn(), clear: vi.fn() };
const wishlist = { has: vi.fn(() => false), toggle: vi.fn() };

vi.mock("@/components/compare/CompareProvider", () => ({ useCompare: () => compare }));
vi.mock("@/lib/wishlist", () => ({ useWishlist: () => wishlist }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const product: ProductCardData = {
  id: "p1",
  title: "Samsung Galaxy A55 5G 8GB 256GB",
  brand: "Samsung",
  category: "mobiles",
  image: null,
  minPrice: 117999,
  maxPrice: 121500,
  rating: 4.4,
  reviewCount: 320,
  priceChange7d: -6.2,
  platforms: ["aliexpress", "daraz", "priceoye"],
  offers: [
    { listingId: "l1", platform: "priceoye", role: "retail", price: 117999, priceUsd: null, originalPrice: null, rating: 4.6, reviewCount: 120, inStock: true, url: "https://priceoye.pk/x", dataSource: "live", lastScrapedAt: null },
    { listingId: "l2", platform: "daraz", role: "retail", price: 121500, priceUsd: null, originalPrice: 130000, rating: 4.3, reviewCount: 200, inStock: true, url: "https://daraz.pk/x", dataSource: "saved", lastScrapedAt: null },
    { listingId: "l3", platform: "aliexpress", role: "supplier", price: 126400, priceUsd: 451.4, originalPrice: null, rating: null, reviewCount: 0, inStock: false, url: "https://aliexpress.com/x", dataSource: "saved", lastScrapedAt: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  compare.ids = [];
  wishlist.has.mockReturnValue(false);
});

describe("ProductCard", () => {
  it("shows title, lowest price, savings and the price drop", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByRole("link", { name: product.title })).toHaveAttribute("href", "/products/p1");
    expect(screen.getByText("Rs 117,999", { selector: "span.t-price" })).toBeInTheDocument();
    expect(screen.getByText("up to Rs 121,500")).toBeInTheDocument();
    expect(screen.getByText("Cheapest on PriceOye, save Rs 3,501")).toBeInTheDocument();
    expect(screen.getByText(/6\.2%/)).toBeInTheDocument();
  });

  it("lists prices per store with saved and out-of-stock labels", () => {
    render(<ProductCard product={product} />);
    const list = screen.getByRole("list", { name: "Prices by store" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("PriceOye");
    expect(items[0]).toHaveTextContent("Rs 117,999");
    expect(items[1]).toHaveTextContent("saved");
    expect(items[2]).toHaveTextContent("out of stock");
    expect(items[2]).toHaveTextContent("supplier");
  });

  it("never calls the supplier price the cheapest", () => {
    const cheapSupplier = { ...product, minPrice: 50000, maxPrice: 60000, offers: [product.offers[0], { ...product.offers[2], price: 50000, inStock: true }] };
    render(<ProductCard product={cheapSupplier} />);
    expect(screen.queryByText(/Cheapest on/)).not.toBeInTheDocument();
  });

  it("hides the savings line for a single-store product", () => {
    render(<ProductCard product={{ ...product, minPrice: 50000, maxPrice: 50000, offers: [product.offers[0]], priceChange7d: 0 }} />);
    expect(screen.queryByText(/Cheapest on/)).not.toBeInTheDocument();
    expect(screen.queryByText(/this week/)).not.toBeInTheDocument();
  });

  it("toggles comparison and wishlist from the card", async () => {
    render(<ProductCard product={product} />);
    await userEvent.click(screen.getByRole("button", { name: "Add to compare" }));
    expect(compare.toggle).toHaveBeenCalledWith("p1");
    await userEvent.click(screen.getByRole("button", { name: /Save .* to wishlist/ }));
    expect(wishlist.toggle).toHaveBeenCalledWith("p1", product.title);
  });

  it("reflects selected and saved state", () => {
    compare.ids = ["p1"];
    wishlist.has.mockReturnValue(true);
    render(<ProductCard product={product} />);
    expect(screen.getByRole("button", { name: "Added to compare" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Remove .* from wishlist/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("falls back to a placeholder when there is no image", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByRole("img", { name: product.title })).toBeInTheDocument();
  });
});

describe("ProductCard: single-store products", () => {
  it("says which store when only one carries the product", () => {
    render(<ProductCard product={{ ...product, minPrice: 8999, maxPrice: 8999, platforms: ["daraz"], priceChange7d: 0, offers: [product.offers[1]] }} />);
    expect(screen.getByText("Only on Daraz")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: product.title })).toBeInTheDocument(); // still a full result card
    expect(screen.queryByText(/Cheapest on/)).not.toBeInTheDocument();
  });

  it("does not claim 'only on' when several stores carry it", () => {
    render(<ProductCard product={product} />);
    expect(screen.queryByText(/^Only on/)).not.toBeInTheDocument();
  });
});
