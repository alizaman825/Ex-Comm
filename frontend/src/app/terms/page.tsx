import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of use", description: "The terms for using Ex-Comm." };

export default function TermsPage() {
  return (
    <div className="page max-w-3xl">
      <header className="mb-10">
        <h1 className="t-h1">Terms of use</h1>
        <p className="t-lead mt-3">Last updated: [OWNER TO CONFIRM — set the date this page goes live].</p>
      </header>

      <div className="prose-section space-y-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="t-h3">What Ex-Comm is</h2>
          <p className="mt-2">
            Ex-Comm is a price comparison service for online shopping in Pakistan. We read publicly available prices from Daraz and PriceOye, and supplier reference prices from AliExpress and eBay, and show them side by side so you can compare. We don&apos;t sell products ourselves and we aren&apos;t a party to any purchase you make on another store — see our <Link href="/methodology" className="underline">Methodology</Link> page for exactly how prices are collected and labelled.
          </p>
        </section>

        <section>
          <h2 className="t-h3">Prices aren&apos;t guaranteed</h2>
          <p className="mt-2">
            We try to keep prices accurate and up to date, but a price shown on Ex-Comm can be out of date by the time you reach the store, and matching the same product across stores is done automatically and can occasionally be wrong. Always confirm the price, stock, shipping cost and any cash-on-delivery terms on the store&apos;s own page before you buy. The store you buy from, not Ex-Comm, is responsible for the sale.
          </p>
        </section>

        <section>
          <h2 className="t-h3">Accounts</h2>
          <p className="mt-2">
            If you create an account, you&apos;re responsible for keeping your login details secure and for anything done under your account. You can use an account to save products, set price alerts and submit reports.
          </p>
        </section>

        <section>
          <h2 className="t-h3">Acceptable use</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Don&apos;t try to disrupt, overload or scrape Ex-Comm itself.</li>
            <li>Don&apos;t use the &quot;Report a problem&quot; feature to submit false reports or personal data about someone else.</li>
            <li>Don&apos;t use the service for anything unlawful.</li>
          </ul>
        </section>

        <section>
          <h2 className="t-h3">Links to other stores</h2>
          <p className="mt-2">
            Ex-Comm links out to stores we don&apos;t control (Daraz, PriceOye, AliExpress, eBay, and others). We aren&apos;t responsible for those stores&apos; content, prices, availability, or how they handle your order or data once you leave Ex-Comm. See our <Link href="/affiliate-disclosure" className="underline">Affiliate disclosure</Link> for whether any of those links earn us anything.
          </p>
        </section>

        <section>
          <h2 className="t-h3">No warranty, limited liability</h2>
          <p className="mt-2">
            Ex-Comm is provided &quot;as is&quot;. [OWNER TO CONFIRM — this section usually states that Ex-Comm is not liable for losses from relying on a price or from a purchase made on another store; confirm the exact wording and whether a jurisdiction/governing-law clause is needed before publishing, ideally with a lawyer&apos;s input since this is a liability-limiting clause.]
          </p>
        </section>

        <section>
          <h2 className="t-h3">Changes to these terms</h2>
          <p className="mt-2">If these terms change, we&apos;ll update the date at the top of this page.</p>
        </section>

        <section>
          <h2 className="t-h3">Contact</h2>
          <p className="mt-2">
            Questions about these terms go to [OWNER TO CONFIRM — contact email/address] or via our <Link href="/contact" className="underline">Contact page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
