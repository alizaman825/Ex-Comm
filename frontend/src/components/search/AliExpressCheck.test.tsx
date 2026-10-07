import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AliExpressCheck } from "./AliExpressCheck";

const apiMock = vi.fn();
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => toast }));

beforeEach(() => vi.clearAllMocks());

describe("AliExpressCheck", () => {
  it("warns that the check takes 30 seconds or more", () => {
    render(<AliExpressCheck query="mi band 8" onChecked={vi.fn()} />);
    expect(screen.getByText(/30 seconds or more/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check on AliExpress" })).toBeEnabled();
  });

  it("checks AliExpress for the query, reloads the results and confirms", async () => {
    apiMock.mockResolvedValue({ status: "success", found: 12 });
    const onChecked = vi.fn();
    render(<AliExpressCheck query="mi band 8" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on AliExpress" }));
    expect(apiMock).toHaveBeenCalledWith("/search/aliexpress", { method: "POST", body: { q: "mi band 8" } });
    await waitFor(() => expect(onChecked).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Added 12 AliExpress results");
  });

  it("shows progress while checking and disables the button", async () => {
    apiMock.mockReturnValue(new Promise(() => {}));
    render(<AliExpressCheck query="mi band 8" onChecked={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on AliExpress" }));
    expect(screen.getByRole("button", { name: "Checking AliExpress…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("30 seconds or more");
  });

  it("reports a failed check without reloading", async () => {
    apiMock.mockResolvedValue({ status: "failed", found: 0, error: "Blocked by AliExpress" });
    const onChecked = vi.fn();
    render(<AliExpressCheck query="mi band 8" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on AliExpress" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChecked).not.toHaveBeenCalled();
  });

  it("offers a re-check once AliExpress has been checked", () => {
    render(<AliExpressCheck query="mi band 8" checkedCount={30} onChecked={vi.fn()} />);
    expect(screen.getByText(/30 results added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check AliExpress again" })).toBeInTheDocument();
  });
});
