import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "./ContactForm";
import { ApiError } from "@/lib/api";

const apiMock = vi.fn();
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: (...a: unknown[]) => apiMock(...a) }));

beforeEach(() => vi.clearAllMocks());

async function fillValid() {
  await userEvent.type(screen.getByLabelText("Email"), "shopper@example.com");
  await userEvent.type(screen.getByLabelText("Message"), "How do I delete my account?");
}

describe("ContactForm", () => {
  it("shows the remaining character count and updates as you type", async () => {
    render(<ContactForm />);
    expect(screen.getByText("2000 characters left")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Message"), "Hello there");
    expect(screen.getByText("1989 characters left")).toBeInTheDocument();
  });

  it("rejects an empty email and empty message without calling the API", async () => {
    render(<ContactForm />);
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Enter your email address")).toBeInTheDocument();
    expect(screen.getByText("Enter a message")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    render(<ContactForm />);
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Message"), "A real message here.");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("submits the honeypot field empty by default and shows a success state", async () => {
    apiMock.mockResolvedValue({ id: "abc" });
    render(<ContactForm />);
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock).toHaveBeenCalledWith("/contact", {
      method: "POST",
      body: { name: undefined, email: "shopper@example.com", topic: "general", message: "How do I delete my account?", website: "" },
    });
    expect(await screen.findByTestId("contact-success")).toBeInTheDocument();
  });

  it("lets a topic other than General be chosen", async () => {
    apiMock.mockResolvedValue({ id: "abc" });
    render(<ContactForm />);
    await fillValid();
    await userEvent.selectOptions(screen.getByLabelText("Topic"), "privacy_request");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock).toHaveBeenCalledWith("/contact", expect.objectContaining({ body: expect.objectContaining({ topic: "privacy_request" }) }));
  });

  it("shows a retry-capable error state when the request fails", async () => {
    apiMock.mockRejectedValue(new ApiError(500, "The server had a problem. Please try again shortly."));
    render(<ContactForm />);
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The server had a problem");
    // The form is still here (not replaced by the success state), so the visitor can just retry.
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });

  it("shows no email address anywhere on the form", () => {
    render(<ContactForm />);
    expect(screen.queryByText(/@excomm/i)).not.toBeInTheDocument();
  });
});
