import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AmazonCheck } from "./AmazonCheck";

const apiMock = vi.fn();
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => toast }));

beforeEach(() => vi.clearAllMocks());

describe("AmazonCheck", () => {
  it("warns that the check can take up to a minute", () => {
    render(<AmazonCheck query="mi band 8" onChecked={vi.fn()} />);
    expect(screen.getByText(/up to a minute/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check on Amazon" })).toBeEnabled();
  });

  it("checks Amazon for the query, reloads the results and confirms", async () => {
    apiMock.mockResolvedValue({ status: "success", found: 7 });
    const onChecked = vi.fn();
    render(<AmazonCheck query="mi band 8" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on Amazon" }));
    expect(apiMock).toHaveBeenCalledWith("/search/amazon", { method: "POST", body: { q: "mi band 8" } });
    await waitFor(() => expect(onChecked).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Added 7 Amazon results");
  });

  it("shows progress while checking and disables the button", async () => {
    apiMock.mockReturnValue(new Promise(() => {}));
    render(<AmazonCheck query="mi band 8" onChecked={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on Amazon" }));
    expect(screen.getByRole("button", { name: "Checking Amazon…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/checking amazon/i);
  });

  it("reports a failed check without reloading", async () => {
    apiMock.mockResolvedValue({ status: "failed", found: 0, error: "Bright Data is not configured" });
    const onChecked = vi.fn();
    render(<AmazonCheck query="mi band 8" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on Amazon" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChecked).not.toHaveBeenCalled();
  });

  it("offers a re-check once Amazon has been checked", () => {
    render(<AmazonCheck query="mi band 8" checkedCount={7} onChecked={vi.fn()} />);
    expect(screen.getByText(/7 results added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check Amazon again" })).toBeInTheDocument();
  });
});
