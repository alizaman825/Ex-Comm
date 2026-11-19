import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheinCheck } from "./SheinCheck";

const apiMock = vi.fn();
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => toast }));

beforeEach(() => vi.clearAllMocks());

describe("SheinCheck", () => {
  it("explains that SHEIN is an international catalog", () => {
    render(<SheinCheck query="floral dress" onChecked={vi.fn()} />);
    expect(screen.getByText(/international catalog/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check on SHEIN" })).toBeEnabled();
  });

  it("checks SHEIN for the query, reloads the results and confirms", async () => {
    apiMock.mockResolvedValue({ status: "success", found: 5 });
    const onChecked = vi.fn();
    render(<SheinCheck query="floral dress" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on SHEIN" }));
    expect(apiMock).toHaveBeenCalledWith("/search/shein", { method: "POST", body: { q: "floral dress" } });
    await waitFor(() => expect(onChecked).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Added 5 SHEIN results");
  });

  it("shows progress while checking and disables the button", async () => {
    apiMock.mockReturnValue(new Promise(() => {}));
    render(<SheinCheck query="floral dress" onChecked={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on SHEIN" }));
    expect(screen.getByRole("button", { name: "Checking SHEIN…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/checking shein/i);
  });

  it("reports a failed check without reloading", async () => {
    apiMock.mockResolvedValue({ status: "failed", found: 0, error: "Blocked by SHEIN" });
    const onChecked = vi.fn();
    render(<SheinCheck query="floral dress" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on SHEIN" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChecked).not.toHaveBeenCalled();
  });

  it("offers a re-check once SHEIN has been checked", () => {
    render(<SheinCheck query="floral dress" checkedCount={5} onChecked={vi.fn()} />);
    expect(screen.getByText(/5 results added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check SHEIN again" })).toBeInTheDocument();
  });
});
