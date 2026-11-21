import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact", description: "How to reach Ex-Comm." };

export default function ContactPage() {
  return (
    <div className="page max-w-2xl">
      <header className="mb-10">
        <h1 className="t-h1">Contact</h1>
        <p className="t-lead mt-3">Ways to reach us.</p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-slate-700">
        <div className="card p-5">
          <h2 className="t-h3">Wrong price or product on a page</h2>
          <p className="mt-2">
            Use the &quot;Report a problem&quot; link on that product&apos;s page — it goes straight to us and doesn&apos;t need an account.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="t-h3">Everything else</h2>
          <p className="mt-2">
            Use the Contact form on this page for anything else — an account question, a privacy request, or anything not covered by &quot;Report a problem&quot; above. Ex-Comm is operated by an individual in Pakistan rather than a company, so there&apos;s no separate office address or phone line to list.
          </p>
        </div>

        <p className="text-slate-500">
          We aim to respond to reports and messages as quickly as we can, though Ex-Comm doesn&apos;t currently offer guaranteed response times.
        </p>
      </div>
    </div>
  );
}
