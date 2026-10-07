import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

const replace = vi.fn();
let searchParams = new URLSearchParams();
const auth = {
  user: null as null | { id: string; name: string; email: string },
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  setUser: vi.fn(),
};
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => toast }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  auth.user = null;
  auth.loading = false;
});

describe("LoginForm", () => {
  it("shows field errors and does not call the API on an empty submit", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter your email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("logs in with a trimmed email and redirects to the safe ?next= page", async () => {
    searchParams = new URLSearchParams("next=/wishlist");
    auth.login.mockResolvedValue({ id: "1", name: "Sara Ahmed", email: "sara@example.com" });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "  sara@example.com ");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith("sara@example.com", "secret123"));
    expect(replace).toHaveBeenCalledWith("/wishlist");
    expect(toast.success).toHaveBeenCalledWith("Welcome back, Sara!");
  });

  it("ignores an unsafe ?next= value", async () => {
    searchParams = new URLSearchParams("next=https://evil.example");
    auth.login.mockResolvedValue({ id: "1", name: "Sara", email: "s@e.com" });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "s@e.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("shows a clear message for wrong credentials (401) and re-enables the button", async () => {
    auth.login.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "sara@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the rate-limit and network errors from the server", async () => {
    auth.login.mockRejectedValue(new ApiError(429, "Too many requests, please try again later."));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "sara@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Too many requests, please try again later.")).toBeInTheDocument();
  });

  it("demo button signs in with the demo account", async () => {
    auth.login.mockResolvedValue({ id: "d", name: "Demo User", email: "demo@excomm.pk" });
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /try the demo account/i }));
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith("demo@excomm.pk", "demo1234"));
  });

  it("toggles password visibility", async () => {
    render(<LoginForm />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
  });

  it("redirects away when already signed in", async () => {
    auth.user = { id: "1", name: "Sara", email: "s@e.com" };
    render(<LoginForm />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});

describe("RegisterForm", () => {
  it("validates all fields before calling the API", async () => {
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Full name"), "A");
    await userEvent.type(screen.getByLabelText("Email"), "bad");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it("registers and redirects", async () => {
    auth.register.mockResolvedValue({ id: "1", name: "Omar Raza", email: "omar@example.com" });
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Full name"), " Omar Raza ");
    await userEvent.type(screen.getByLabelText("Email"), "omar@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password1");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(auth.register).toHaveBeenCalledWith("Omar Raza", "omar@example.com", "password1"));
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows a duplicate-email error with a link to log in", async () => {
    auth.register.mockRejectedValue(new ApiError(409, "An account with this email already exists"));
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Full name"), "Omar Raza");
    await userEvent.type(screen.getByLabelText("Email"), "omar@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password1");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("An account with this email already exists")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in instead" })).toHaveAttribute("href", "/login");
  });

  it("maps server validation details onto fields", async () => {
    auth.register.mockRejectedValue(new ApiError(400, "Name must be at least 2 characters", [{ field: "name", message: "Server says name is invalid" }]));
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Full name"), "Omar Raza");
    await userEvent.type(screen.getByLabelText("Email"), "omar@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password1");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Server says name is invalid")).toBeInTheDocument();
  });

  it("shows password strength while typing", async () => {
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Password"), "Abcdefg1!xyz");
    expect(screen.getByText("Password strength: Strong")).toBeInTheDocument();
  });
});
