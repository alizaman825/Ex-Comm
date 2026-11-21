import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductImage } from "./ProductImage";

// Phase 4 Part B2/B3: a card must never show a blank white image box - every path that is not a real,
// loadable photo falls back to the category placeholder tile instead.
describe("ProductImage", () => {
  it("renders the category placeholder when there is no image URL", () => {
    render(<ProductImage src={null} alt="Some Product" category="mobiles" />);
    expect(screen.getByRole("img", { name: "Some Product" })).toBeInTheDocument();
    expect(screen.queryByRole("img")?.tagName).toBe("DIV"); // the placeholder tile, not a real <img>
  });

  it("renders the category placeholder when the image URL is an empty string", () => {
    render(<ProductImage src="" alt="Some Product" category="mobiles" />);
    expect(screen.getByRole("img", { name: "Some Product" }).tagName).toBe("DIV");
  });

  it("renders the category placeholder when the image URL is only whitespace", () => {
    render(<ProductImage src="   " alt="Some Product" category="mobiles" />);
    expect(screen.getByRole("img", { name: "Some Product" }).tagName).toBe("DIV");
  });

  it("falls back to the category placeholder when the real photo fails to load (404, hotlink block, etc.)", () => {
    const { container } = render(<ProductImage src="https://example.com/broken.jpg" alt="Some Product" category="laptops" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);
    expect(screen.getByRole("img", { name: "Some Product" }).tagName).toBe("DIV");
  });

  it("loads a real photo eagerly, at high priority, for above-the-fold cards", () => {
    const { container } = render(<ProductImage src="https://example.com/ok.jpg" alt="Some Product" category="laptops" priority />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.loading).toBe("eager");
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });

  it("loads a real photo lazily by default", () => {
    const { container } = render(<ProductImage src="https://example.com/ok.jpg" alt="Some Product" category="laptops" />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.loading).toBe("lazy");
  });
});
