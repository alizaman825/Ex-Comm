import type { Metadata } from "next";

export const metadata: Metadata = { title: "Affiliate disclosure", description: "Whether Ex-Comm earns anything from the links it shows." };

export default function AffiliateDisclosurePage() {
  return (
    <div className="page max-w-2xl">
      <header className="mb-10">
        <h1 className="t-h1">Affiliate disclosure</h1>
        <p className="t-lead mt-3">Last updated: 21 November 2026.</p>
      </header>

      <div className="space-y-4 text-sm leading-relaxed text-slate-700">
        <p>
          Ex-Comm has <strong>no</strong> affiliate or referral relationship with Daraz or PriceOye, and earns nothing from the links to those stores. Links to Daraz and PriceOye take you directly to that store&apos;s own product page, with no affiliate or referral tag attached.
        </p>
        <p>
          Ex-Comm has applied to AliExpress&apos;s affiliate program; that application is still pending. If it is approved, a link to AliExpress may earn Ex-Comm a small commission in future, at no extra cost to you — this page will be updated first, before any such link goes live, to say so and give the date that started. Links to eBay currently earn nothing either.
        </p>
        <p className="text-slate-500">We&apos;ll keep this page accurate as that changes.</p>
      </div>
    </div>
  );
}
