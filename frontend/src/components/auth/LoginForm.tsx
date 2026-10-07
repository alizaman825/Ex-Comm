"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ApiError, errorMessage } from "@/lib/api";
import { safeNext } from "@/lib/format";
import { validateEmail } from "@/lib/validation";
import { Button, Field } from "@/components/ui/primitives";
import { PasswordField } from "./PasswordField";
import { useToast } from "@/components/ui/Toast";

const DEMO = { email: "demo@excomm.pk", password: "demo1234" };

export function LoginForm() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: go where they were headed.
  useEffect(() => {
    if (!loading && user && !submitting) router.replace(next);
  }, [loading, user, submitting, next, router]);

  async function attempt(mail: string, pass: string) {
    setSubmitting(true);
    setFormError(null);
    try {
      const u = await login(mail.trim(), pass);
      toast.success(`Welcome back, ${u.name.split(" ")[0]}!`);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setFormError("Incorrect email or password. Please check and try again.");
      else setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = { email: validateEmail(email), password: password ? undefined : "Enter your password" };
    setErrors(next);
    if (next.email || next.password) return;
    void attempt(email, password);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}
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
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        placeholder="Your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      <Button type="submit" size="lg" className="w-full" loading={submitting}>
        {submitting ? "Logging in…" : "Log in"}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-slate-200" />
        </div>
        <p className="relative mx-auto w-fit bg-slate-50 px-3 text-xs uppercase tracking-wide text-slate-400">or</p>
      </div>

      <Button
        variant="secondary"
        className="w-full"
        disabled={submitting}
        onClick={() => {
          setEmail(DEMO.email);
          setPassword(DEMO.password);
          setErrors({});
          void attempt(DEMO.email, DEMO.password);
        }}
      >
        <Sparkles className="h-4 w-4 text-brand-600" aria-hidden /> Try the demo account
      </Button>
      <p className="text-center text-xs text-slate-400">
        Demo account comes with a sample wishlist, alerts and notifications. New here?{" "}
        <Link href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
