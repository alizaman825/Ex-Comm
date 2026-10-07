import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CompareProvider } from "@/components/compare/CompareProvider";
import { CompareTray } from "@/components/compare/CompareTray";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Ex-Comm: compare prices across Daraz, PriceOye and AliExpress", template: "%s | Ex-Comm" },
  description: "Search once, compare prices across Pakistani online stores, track price history and get alerts when prices drop.",
};

export const viewport: Viewport = {
  themeColor: "#FBF8F3",
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint: dark only when the visitor switched it on earlier (never from the OS setting).
const THEME_SCRIPT = `try{if(localStorage.getItem("excomm-theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-surface focus:px-5 focus:py-2 focus:shadow-lift">
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
