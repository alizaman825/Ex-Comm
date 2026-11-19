import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemuCheck } from "./TemuCheck";

const apiMock = vi.fn();
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => toast }));

beforeEach(() => vi.clearAllMocks());

describe("TemuCheck", () => {
  it("explains that Temu is an international reference price", () => {
    render(<TemuCheck query="wireless earbuds" onChecked={vi.fn()} />);
    expect(screen.getByText(/international reference price/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check on Temu" })).toBeEnabled();
  });

  it("checks Temu for the query, reloads the results and confirms", async () => {
    apiMock.mockResolvedValue({ status: "success", found: 5 });
    const onChecked = vi.fn();
    render(<TemuCheck query="wireless earbuds" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on Temu" }));
    expect(apiMock).toHaveBeenCalledWith("/search/temu", { method: "POST", body: { q: "wireless earbuds" } });
    await waitFor(() => expect(onChecked).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Added 5 Temu results");
  });

  it("shows progress while checking and disables the button", async () => {
    apiMock.mockReturnValue(new Promise(() => {}));
    render(<TemuCheck query="wireless earbuds" onChecked={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on Temu" }));
    expect(screen.getByRole("button", { name: "Checking Temu…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/checking temu/i);
  });

  it("reports a failed check without reloading", async () => {
    apiMock.mockResolvedValue({ status: "failed", found: 0, error: "Blocked by Temu" });
    const onChecked = vi.fn();
    render(<TemuCheck query="wireless earbuds" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on Temu" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChecked).not.toHaveBeenCalled();
  });

  it("offers a re-check once Temu has been checked", () => {
    render(<TemuCheck query="wireless earbuds" checkedCount={5} onChecked={vi.fn()} />);
    expect(screen.getByText(/5 results added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check Temu again" })).toBeInTheDocument();
  });
});
