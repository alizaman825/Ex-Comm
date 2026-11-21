import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with Ex-Comm." };

export default function ContactPage() {
  return (
    <div className="page max-w-2xl">
      <header className="mb-10">
        <h1 className="t-h1">Contact</h1>
        <p className="t-lead mt-3">
          Send us a message below. For a wrong price or product on a specific page, the &quot;Report a problem&quot; link on that
          page goes straight to us and doesn&apos;t need an account.
        </p>
      </header>

      <ContactForm />

      <p className="mt-6 text-center text-xs text-slate-400">
        Ex-Comm is operated by an individual in Pakistan rather than a company, so there&apos;s no separate office address or
        phone line to list. We aim to respond as quickly as we can, though we don&apos;t currently offer guaranteed response
        times.
      </p>
    </div>
  );
}
