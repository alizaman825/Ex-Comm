import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CompareProvider } from "@/components/compare/CompareProvider";
import { CompareTray } from "@/components/compare/CompareTray";

export const metadata: Metadata = {
  title: { default: "Ex-Comm: compare prices across Daraz, PriceOye and AliExpress", template: "%s | Ex-Comm" },
  description: "Search once, compare prices across Pakistani online stores, track price history and get alerts when prices drop.",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
          Skip to content
        </a>
        <AuthProvider>
          <ToastProvider>
            <CompareProvider>
              <Navbar />
              <main id="main" className="flex-1">
                {children}
              </main>
              <Footer />
              <CompareTray />
            </CompareProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
