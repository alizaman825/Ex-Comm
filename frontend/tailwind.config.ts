import type { Config } from "tailwindcss";

/**
 * Ex-Comm design tokens (single palette).
 *  - brand:   indigo, the only accent colour (actions, links, focus)
 *  - slate:   neutrals (text, borders, surfaces)
 *  - emerald: savings / lowest price / success
 *  - rose:    price increase / errors
 *  - amber:   warnings and "saved data" labels
 * Platform colours are used only for small dots and badges.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "80rem" },
    },
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        ink: "#0f172a",
        platform: {
          daraz: "#f57224",
          priceoye: "#0ea5e9",
          aliexpress: "#e62e04",
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing }]
        display: ["3.25rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "700" }],
        h1: ["2rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["1.375rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["1rem", { lineHeight: "1.4", fontWeight: "600" }],
      },
      borderRadius: {
        card: "0.875rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.05), 0 1px 3px rgb(15 23 42 / 0.08)",
        lift: "0 4px 6px -1px rgb(15 23 42 / 0.07), 0 12px 24px -6px rgb(15 23 42 / 0.12)",
        ring: "0 0 0 4px rgb(99 102 241 / 0.18)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "toast-in": { from: { opacity: "0", transform: "translateY(12px) scale(0.98)" }, to: { opacity: "1", transform: "translateY(0) scale(1)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.4s ease-out both",
        "toast-in": "toast-in 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
