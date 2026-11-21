import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy", description: "What information Ex-Comm collects and how it is used." };

export default function PrivacyPage() {
  return (
    <div className="page max-w-3xl">
      <header className="mb-10">
        <h1 className="t-h1">Privacy policy</h1>
        <p className="t-lead mt-3">Last updated: 21 November 2026.</p>
      </header>

      <div className="prose-section space-y-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="t-h3">What this page covers</h2>
          <p className="mt-2">
            This policy explains what information Ex-Comm collects when you use the site, why, and what you can do about it. Ex-Comm is a price comparison service: we read public prices from other stores and show them to you, and we don&apos;t sell anything ourselves.
          </p>
        </section>

        <section>
          <h2 className="t-h3">Information we collect</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Account information.</strong> If you register, we store your name, email address and a securely hashed password (never the password itself).</li>
            <li><strong>Price alerts and wishlist.</strong> If you save a product or set a target price, we store which product and what price, tied to your account.</li>
            <li><strong>Reports.</strong> If you use &quot;Report a problem&quot; on a product page, we store the report text and, if you choose to give one, an email address to follow up.</li>
            <li><strong>Usage data.</strong> Standard web server logs (IP address, pages requested, timestamps) for security and abuse prevention, kept only as long as needed for that purpose.</li>
            <li><strong>Cookies / local storage.</strong> Used to keep you signed in and remember basic preferences. We do not use third-party advertising or tracking cookies.</li>
          </ul>
        </section>

        <section>
          <h2 className="t-h3">What we don&apos;t do</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>We don&apos;t sell your personal information to anyone.</li>
            <li>We don&apos;t share your email or account details with the stores we compare prices from.</li>
            <li>We don&apos;t show your reports or alerts to other users.</li>
          </ul>
        </section>

        <section>
          <h2 className="t-h3">How long we keep information</h2>
          <p className="mt-2">
            Account data is kept while your account is active. You can delete your account at any time from your <a href="/profile" className="underline">Profile</a> page, or by contacting us through the Contact form and we will delete it for you. Reports are kept long enough to act on them and then as a record of the issue.
          </p>
        </section>

        <section>
          <h2 className="t-h3">Your rights</h2>
          <p className="mt-2">
            You can ask to see, correct or delete the personal information we hold about you by contacting us through the <a href="/contact" className="underline">Contact</a> form, or by using the account tools on your Profile page. Ex-Comm is operated by an individual in Pakistan, not a registered company; we make no claim about registration under, or compliance with, any specific data protection law.</p>
        </section>

        <section>
          <h2 className="t-h3">Changes to this policy</h2>
          <p className="mt-2">If this policy changes, we&apos;ll update the date at the top of this page.</p>
        </section>

        <section>
          <h2 className="t-h3">Contact</h2>
          <p className="mt-2">
            Questions about this policy go through our <a href="/contact" className="underline">Contact page</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
