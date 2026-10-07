import type { Config } from "tailwindcss";

/**
 * Ex-Comm design tokens. Every colour is a CSS variable (space-separated RGB channels, defined in
 * globals.css for light and for [data-theme="dark"]), so one change restyles the whole app.
 *  - slate:   warm neutrals (text, borders, tinted panels); slate-900 is the ink colour
 *  - brand:   the "ink" scale (primary buttons, links, focus); flips to cream in dark mode
 *  - emerald: savings, lowest price, profit
 *  - amber:   the yellow highlight (badges, swashes, saved-data labels)
 *  - rose:    price rises, losses, errors
 *  - peach/mint/sky/lilac/butter: pastel section backgrounds
 * Store colours are used only for small dots and badges.
 */
const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "80rem" },
    },
    extend: {
      colors: {
        slate: scale("slate", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        brand: scale("brand", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        emerald: scale("emerald", [50, 100, 200, 500, 600, 700, 900]),
        amber: scale("amber", [50, 100, 200, 400, 500, 600, 700, 800, 900]),
        rose: scale("rose", [50, 100, 200, 400, 500, 600, 700, 800]),
        canvas: token("bg"),
        surface: token("surface"),
        raised: token("raised"),
        ink: token("slate-900"),
        onbrand: token("on-brand"),
        onaccent: token("on-accent"),
        highlight: token("yellow"),
        peach: token("peach"),
        mint: token("mint"),
        sky: token("sky"),
        lilac: token("lilac"),
        butter: token("butter"),
        platform: {
          daraz: "#F57224",
          priceoye: "#1E88E5",
          aliexpress: "#E5322D",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Fluid sizes. [size, { lineHeight, letterSpacing, fontWeight }]
        giant: ["clamp(4rem, 17vw, 15rem)", { lineHeight: "0.82", letterSpacing: "-0.05em", fontWeight: "800" }],
        hero: ["clamp(3rem, 3.2rem + 5.6vw, 9rem)", { lineHeight: "0.9", letterSpacing: "-0.045em", fontWeight: "800" }],
        display: ["clamp(2.25rem, 1.4rem + 3.6vw, 4.5rem)", { lineHeight: "0.98", letterSpacing: "-0.035em", fontWeight: "800" }],
        h1: ["clamp(1.75rem, 1.2rem + 1.8vw, 2.75rem)", { lineHeight: "1.08", letterSpacing: "-0.03em", fontWeight: "800" }],
        h2: ["clamp(1.375rem, 1.1rem + 1vw, 2rem)", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "700" }],
        h3: ["1rem", { lineHeight: "1.4", letterSpacing: "-0.01em", fontWeight: "700" }],
      },
      borderRadius: {
        card: "1.5rem",
        field: "0.875rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        float: "var(--shadow-float)",
        ring: "0 0 0 4px rgb(var(--brand-500) / 0.18)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "toast-in": { from: { opacity: "0", transform: "translateY(12px) scale(0.98)" }, to: { opacity: "1", transform: "translateY(0) scale(1)" } },
        "pop-in": { "0%": { opacity: "0", transform: "scale(0.85)" }, "60%": { transform: "scale(1.04)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        "draw-line": { to: { strokeDashoffset: "0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "toast-in": "toast-in 0.25s cubic-bezier(0.22,1,0.36,1) both",
        "pop-in": "pop-in 0.4s cubic-bezier(0.22,1,0.36,1) both",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
