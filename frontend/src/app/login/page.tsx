import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see your wishlist, price alerts and notifications."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-brand-600 hover:underline">
            Sign up free
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="skeleton h-64 w-full" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
