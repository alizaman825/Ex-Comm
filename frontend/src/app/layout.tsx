import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "@fontsource/bebas-neue";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CompareProvider } from "@/components/compare/CompareProvider";
import { CompareTray } from "@/components/compare/CompareTray";
import { CinematicAtmosphere } from "@/components/cinematic/CinematicAtmosphere";
import { TiltEffect } from "@/components/cinematic/TiltEffect";
import { DEFAULT_UI_THEME } from "@/lib/ui-theme";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Ex-Comm: compare prices across Daraz, PriceOye and AliExpress", template: "%s | Ex-Comm" },
  description: "Search once, compare prices across Pakistani online stores, track price history and get alerts when prices drop.",
  // Light is the only default: ask browsers and extensions not to auto-darken the page.
  other: { "color-scheme": "light", "darkreader-lock": "" },
};

export const viewport: Viewport = {
  themeColor: "#FBF8F3",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint: dark only when the visitor switched it on earlier (never from the OS setting).
const THEME_SCRIPT = `try{var t=localStorage.getItem("excomm-theme");if(t==="dark"){document.documentElement.setAttribute("data-theme","dark")}else{document.documentElement.removeAttribute("data-theme");if(t!==null&&t!=="light")localStorage.removeItem("excomm-theme")}}catch(e){}`;

// Runs before first paint: applies the visitor's own choice (saved by UiThemeToggle) over the
// NEXT_PUBLIC_UI_THEME default baked into DEFAULT_UI_THEME, so there is no flash of the other theme.
const UI_THEME_SCRIPT = `try{var t=localStorage.getItem("excomm-ui-theme");var d=${JSON.stringify(DEFAULT_UI_THEME)};var v=(t==="classic"||t==="cinematic")?t:d;document.documentElement.setAttribute("data-ui-theme",v);}catch(e){document.documentElement.setAttribute("data-ui-theme",${JSON.stringify(DEFAULT_UI_THEME)});}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} data-ui-theme={DEFAULT_UI_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: UI_THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-surface focus:px-5 focus:py-2 focus:shadow-lift">
          Skip to content
        </a>
        <CinematicAtmosphere />
        <TiltEffect />
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
