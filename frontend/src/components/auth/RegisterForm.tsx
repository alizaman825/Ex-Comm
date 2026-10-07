"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";
import { ApiError, errorMessage } from "@/lib/api";
import { safeNext } from "@/lib/format";
import { passwordStrength, validateEmail, validateName, validateNewPassword } from "@/lib/validation";
import { Button, Field } from "@/components/ui/primitives";
import { PasswordField } from "./PasswordField";
import { useToast } from "@/components/ui/Toast";

type Errors = { name?: string; email?: string; password?: string };

const STRENGTH_TONE = ["bg-slate-300", "bg-rose-500", "bg-amber-500", "bg-emerald-500"];

export function RegisterForm() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const next = safeNext(params.get("next"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && !submitting) router.replace(next);
  }, [loading, user, submitting, next, router]);

  const strength = passwordStrength(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found: Errors = { name: validateName(name), email: validateEmail(email), password: validateNewPassword(password) };
    setErrors(found);
    setEmailTaken(false);
    setFormError(null);
    if (found.name || found.email || found.password) return;

    setSubmitting(true);
    try {
      const u = await register(name.trim(), email.trim(), password);
      toast.success(`Account created. Welcome, ${u.name.split(" ")[0]}!`);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: "An account with this email already exists" });
        setEmailTaken(true);
      } else if (err instanceof ApiError && err.status === 400 && err.details?.length) {
        setErrors({ name: err.fieldError("name"), email: err.fieldError("email"), password: err.fieldError("password") });
      } else {
        setFormError(errorMessage(err));
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}
      <Field label="Full name" name="name" autoComplete="name" placeholder="Ayesha Khan" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
      <div>
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
        />
        {emailTaken && (
          <p className="mt-1.5 text-xs text-slate-500">
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Log in instead
            </Link>
          </p>
        )}
      </div>
      <div>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        {password && (
          <div className="mt-2.5" aria-live="polite">
            <div className="flex gap-1.5" aria-hidden>
              {[1, 2, 3].map((i) => (
                <span key={i} className={clsx("h-1.5 flex-1 rounded-full transition-colors", strength.score >= i ? STRENGTH_TONE[strength.score] : "bg-slate-200")} />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Password strength: {strength.label}</p>
          </div>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" loading={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-xs text-slate-400">By signing up you agree this is a student project: do not reuse an important password.</p>
    </form>
  );
}
