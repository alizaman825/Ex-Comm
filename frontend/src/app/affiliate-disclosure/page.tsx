import type { Metadata } from "next";

export const metadata: Metadata = { title: "Affiliate disclosure", description: "Whether Ex-Comm earns anything from the links it shows." };

export default function AffiliateDisclosurePage() {
  return (
    <div className="page max-w-2xl">
      <header className="mb-10">
        <h1 className="t-h1">Affiliate disclosure</h1>
      </header>

      <div className="space-y-4 text-sm leading-relaxed text-slate-700">
        <p>
          Ex-Comm currently does <strong>not</strong> run an affiliate program and does not earn a commission on the store links shown on this site. Every link to Daraz, PriceOye, AliExpress or eBay takes you directly to that store&apos;s own product page, with no affiliate or referral tag attached.
        </p>
        <p>
          [OWNER TO CONFIRM — if this changes (for example, joining a store&apos;s affiliate program), update this page first, before any affiliate link goes live, to say which stores are affiliated, that a link may earn Ex-Comm a commission at no extra cost to you, and the date that started.]
        </p>
        <p className="text-slate-500">We&apos;ll keep this page accurate as that changes.</p>
      </div>
    </div>
  );
}
