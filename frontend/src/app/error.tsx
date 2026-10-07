"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

// Catches unexpected rendering errors in any page so the visitor sees a recoverable screen, not a blank page.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center" role="alert">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="t-h1 mt-5">Something went wrong</h1>
      <p className="t-lead mt-3 max-w-md">An unexpected error stopped this page from loading. You can try again, or go back to the home page.</p>
      <div className="mt-8 flex gap-3">
        <button type="button" className="btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Home
        </Link>
      </div>
    </section>
  );
}
