import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api";
import type { Listing } from "@/lib/types";
import { AlertDialog, parseTarget, validateTarget } from "./AlertDialog";
import { OfferTable } from "./OfferTable";

const apiMock = vi.fn();
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: (...args: unknown[]) => apiMock(...args) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => toast }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

beforeEach(() => vi.clearAllMocks());

describe("target price parsing", () => {
  it("accepts rupee formatting", () => {
    expect(parseTarget("119,999")).toBe(119999);
    expect(parseTarget("Rs 99999")).toBe(99999);
    expect(parseTarget("")).toBeNaN();
    expect(parseTarget("-5")).toBe(-5);
    expect(parseTarget("12abc")).toBeNaN();
  });
  it("validates", () => {
    expect(validateTarget("")).toMatch(/Enter the price/);
    expect(validateTarget("abc")).toMatch(/Enter a number/);
    expect(validateTarget("0")).toMatch(/greater than 0/);
    expect(validateTarget("999999999")).toMatch(/too high/);
    expect(validateTarget("99999")).toBeUndefined();
  });
});

function renderDialog(currentPrice: number | null = 120000) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<AlertDialog open onClose={onClose} productId="p1" title="Samsung Galaxy A55" currentPrice={currentPrice} platforms={["daraz", "priceoye", "aliexpress"]} onSaved={onSaved} />);
  return { onClose, onSaved };
}

describe("AlertDialog", () => {
  it("suggests a target 10% below the current price and shows the current price", () => {
    renderDialog(120000);
    expect(screen.getByLabelText("Notify me when the price is")).toHaveValue("108000");
    expect(screen.getByText("Rs 120,000")).toBeInTheDocument();
  });

  it("validates before calling the API", async () => {
    renderDialog();
    const input = screen.getByLabelText("Notify me when the price is");
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole("button", { name: "Create alert" }));
    expect(await screen.findByText("Enter the price you want to pay")).toBeInTheDocument();
    await userEvent.type(input, "-5");
    await userEvent.click(screen.getByRole("button", { name: "Create alert" }));
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("creates an alert for the chosen store and confirms", async () => {
    apiMock.mockResolvedValue({ alert: {}, updated: false, triggeredNow: false });
    const { onSaved } = renderDialog();
    await userEvent.selectOptions(screen.getByLabelText("Store"), "daraz");
    await userEvent.click(screen.getByRole("button", { name: "Create alert" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/alerts", { method: "POST", body: { productId: "p1", targetPrice: 108000, platform: "daraz" } }));
    expect(await screen.findByTestId("alert-success")).toHaveTextContent("We will notify you when Daraz drops to Rs 108,000");
    expect(screen.getByRole("link", { name: "View my alerts" })).toHaveAttribute("href", "/alerts");
    expect(toast.success).toHaveBeenCalledWith("Price alert created");
    expect(onSaved).toHaveBeenCalled();
  });

  it("explains when the target is already reached", async () => {
    apiMock.mockResolvedValue({ alert: {}, updated: true, triggeredNow: true });
    renderDialog(120000);
    const input = screen.getByLabelText("Notify me when the price is");
    await userEvent.clear(input);
    await userEvent.type(input, "150000");
    expect(screen.getByText(/already been reached/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create alert" }));
    expect(await screen.findByTestId("alert-success")).toHaveTextContent("already at or below your target");
    expect(toast.success).toHaveBeenCalledWith("Price alert updated");
  });

  it("shows server errors without closing", async () => {
    apiMock.mockRejectedValue(new ApiError(500, "Internal server error"));
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Create alert" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
    expect(screen.getByRole("button", { name: "Create alert" })).toBeEnabled();
  });

  it("closes on Cancel", async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});

const listing = (over: Partial<Listing>): Listing => ({
  id: "l", platform: "daraz", role: "retail", title: "T", url: "https://x", image: null, price: 100000, priceUsd: null, originalPrice: null, discountPct: 0,
  currency: "PKR", rating: 4.5, reviewCount: 10, inStock: true, dataSource: "live", lastScrapedAt: null, ...over,
});

describe("OfferTable", () => {
  it("highlights the lowest in-stock retail price and keeps the supplier separate", () => {
    render(
      <OfferTable
        listings={[
          listing({ id: "a", platform: "daraz", price: 121500, originalPrice: 130000, discountPct: 7, dataSource: "saved" }),
          listing({ id: "b", platform: "priceoye", price: 117999 }),
          listing({ id: "c", platform: "aliexpress", role: "supplier", price: 90000, priceUsd: 321.43, dataSource: "saved" }),
        ]}
      />
    );
    const rows = screen.getAllByTestId("offer-row");
    expect(rows.map((r) => r.getAttribute("data-platform"))).toEqual(["priceoye", "daraz", "aliexpress"]); // retail by price, then supplier
    expect(within(rows[0]).getByText("Lowest")).toBeInTheDocument();
    expect(within(rows[1]).queryByText("Lowest")).not.toBeInTheDocument();
    expect(within(rows[1]).getByText("7% off")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Saved")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Supplier")).toBeInTheDocument();
    expect(within(rows[2]).getByText(/\$321\.43/)).toBeInTheDocument();
    expect(within(rows[2]).queryByText("Lowest")).not.toBeInTheDocument(); // a cheaper supplier is never "lowest"
  });

  it("ignores out-of-stock listings when choosing the lowest", () => {
    render(<OfferTable listings={[listing({ id: "a", platform: "daraz", price: 90000, inStock: false }), listing({ id: "b", platform: "priceoye", price: 110000 })]} />);
    const rows = screen.getAllByTestId("offer-row");
    const lowest = rows.find((r) => within(r).queryByText("Lowest"));
    expect(lowest?.getAttribute("data-platform")).toBe("priceoye");
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("opens store links in a new tab safely", () => {
    render(<OfferTable listings={[listing({ id: "a", url: "https://www.daraz.pk/products/x" })]} />);
    const link = screen.getByRole("link", { name: /Go to Daraz/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
