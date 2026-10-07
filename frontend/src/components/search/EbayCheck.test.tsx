import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EbayCheck } from "./EbayCheck";

const apiMock = vi.fn();
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => toast }));

beforeEach(() => vi.clearAllMocks());

describe("EbayCheck", () => {
  it("explains that eBay is an international reference price", () => {
    render(<EbayCheck query="mi band 8" onChecked={vi.fn()} />);
    expect(screen.getByText(/international reference price/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check on eBay" })).toBeEnabled();
  });

  it("checks eBay for the query, reloads the results and confirms", async () => {
    apiMock.mockResolvedValue({ status: "success", found: 5 });
    const onChecked = vi.fn();
    render(<EbayCheck query="mi band 8" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on eBay" }));
    expect(apiMock).toHaveBeenCalledWith("/search/ebay", { method: "POST", body: { q: "mi band 8" } });
    await waitFor(() => expect(onChecked).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Added 5 eBay results");
  });

  it("shows progress while checking and disables the button", async () => {
    apiMock.mockReturnValue(new Promise(() => {}));
    render(<EbayCheck query="mi band 8" onChecked={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on eBay" }));
    expect(screen.getByRole("button", { name: "Checking eBay…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/checking eBay/i);
  });

  it("reports a failed check without reloading", async () => {
    apiMock.mockResolvedValue({ status: "failed", found: 0, error: "eBay is not configured" });
    const onChecked = vi.fn();
    render(<EbayCheck query="mi band 8" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on eBay" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChecked).not.toHaveBeenCalled();
  });

  it("offers a re-check once eBay has been checked", () => {
    render(<EbayCheck query="mi band 8" checkedCount={5} onChecked={vi.fn()} />);
    expect(screen.getByText(/5 results added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check eBay again" })).toBeInTheDocument();
  });
});
