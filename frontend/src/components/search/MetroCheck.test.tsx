import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetroCheck } from "./MetroCheck";

const apiMock = vi.fn();
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => toast }));

beforeEach(() => vi.clearAllMocks());

describe("MetroCheck", () => {
  it("explains that Metro Online is not searched automatically yet", () => {
    render(<MetroCheck query="galaxy a55" onChecked={vi.fn()} />);
    expect(screen.getByText(/not searched automatically yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check on Metro Online" })).toBeEnabled();
  });

  it("checks Metro Online for the query, reloads the results and confirms", async () => {
    apiMock.mockResolvedValue({ status: "success", found: 5 });
    const onChecked = vi.fn();
    render(<MetroCheck query="galaxy a55" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on Metro Online" }));
    expect(apiMock).toHaveBeenCalledWith("/search/metro", { method: "POST", body: { q: "galaxy a55" } });
    await waitFor(() => expect(onChecked).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Added 5 Metro Online results");
  });

  it("shows progress while checking and disables the button", async () => {
    apiMock.mockReturnValue(new Promise(() => {}));
    render(<MetroCheck query="galaxy a55" onChecked={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on Metro Online" }));
    expect(screen.getByRole("button", { name: "Checking Metro Online…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/checking metro online/i);
  });

  it("reports a failed check without reloading", async () => {
    apiMock.mockResolvedValue({ status: "failed", found: 0, error: "Blocked by Metro Online" });
    const onChecked = vi.fn();
    render(<MetroCheck query="galaxy a55" onChecked={onChecked} />);
    await userEvent.click(screen.getByRole("button", { name: "Check on Metro Online" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChecked).not.toHaveBeenCalled();
  });

  it("offers a re-check once Metro Online has been checked", () => {
    render(<MetroCheck query="galaxy a55" checkedCount={5} onChecked={vi.fn()} />);
    expect(screen.getByText(/5 results added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check Metro Online again" })).toBeInTheDocument();
  });
});
