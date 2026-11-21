"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { api, errorMessage, ApiError } from "@/lib/api";
import { validateEmail } from "@/lib/validation";
import { Button, Field } from "@/components/ui/primitives";

type Topic = "general" | "report_problem" | "business" | "privacy_request";

const TOPIC_LABEL: Record<Topic, string> = {
  general: "General",
  report_problem: "Report a problem",
  business: "Business/partnership",
  privacy_request: "Privacy request",
};

const MESSAGE_MAX = 2000;

type Errors = { email?: string; message?: string };

function validateMessage(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Enter a message";
  if (v.length > MESSAGE_MAX) return `Message must be ${MESSAGE_MAX} characters or fewer`;
  return undefined;
}

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>("general");
  const [message, setMessage] = useState("");
  // Honeypot: real visitors never see this field (visually hidden, aria-hidden, unreachable by Tab),
  // so any value in it means a bot filled every field on the page.
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const remaining = MESSAGE_MAX - message.length;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found: Errors = { email: validateEmail(email), message: validateMessage(message) };
    setErrors(found);
    setFormError(null);
    if (found.email || found.message) return;

    setSubmitting(true);
    try {
      await api("/contact", {
        method: "POST",
        body: { name: name.trim() || undefined, email: email.trim(), topic, message: message.trim(), website },
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setErrors({ email: err.fieldError("email"), message: err.fieldError("message") });
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function sendAnother() {
    setDone(false);
    setName("");
    setEmail("");
    setTopic("general");
    setMessage("");
    setErrors({});
    setFormError(null);
  }

  if (done) {
    return (
      <div className="card flex flex-col items-center px-6 py-14 text-center" data-testid="contact-success">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="t-h3 mt-4">Message sent</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Thanks for reaching out. We&apos;ll get back to you at the email address you gave, as soon as we can.
        </p>
        <Button variant="secondary" className="mt-6" onClick={sendAnother}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-5 p-6">
      {formError && (
        <div role="alert" className="alert-danger flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      {/* Honeypot field: hidden from real visitors and screen readers, unreachable by keyboard. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="contact-website">Leave this field blank</label>
        <input id="contact-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <Field label="Name (optional)" name="name" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />

      <Field
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        autoFocus
      />

      <div>
        <label htmlFor="contact-topic" className="label">
          Topic
        </label>
        <select id="contact-topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
          {Object.entries(TOPIC_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="contact-message" className="label">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={6}
          placeholder="How can we help?"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          maxLength={MESSAGE_MAX}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby="contact-message-count"
          className={`input${errors.message ? " input-error" : ""}`}
        />
        <div className="mt-1.5 flex items-center justify-between">
          {errors.message ? (
            <p className="field-error" role="alert">
              {errors.message}
            </p>
          ) : (
            <span />
          )}
          <p id="contact-message-count" className={`text-xs ${remaining < 0 ? "text-rose-500" : "text-slate-400"}`}>
            {remaining} characters left
          </p>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={submitting}>
        {submitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
