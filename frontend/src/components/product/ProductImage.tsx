"use client";

import { useState } from "react";
import { Armchair, Camera, Headphones, Laptop, Shirt, Smartphone, Watch, Package } from "lucide-react";
import clsx from "clsx";

/** Icon for a category slug (also used by the categories pages). */
export function CategoryIcon({ slug, className, strokeWidth }: { slug: string | null | undefined; className?: string; strokeWidth?: number }) {
  const props = { className, strokeWidth, "aria-hidden": true as const };
  switch (slug) {
    case "mobiles":
      return <Smartphone {...props} />;
    case "laptops":
      return <Laptop {...props} />;
    case "audio":
      return <Headphones {...props} />;
    case "watches":
      return <Watch {...props} />;
    case "home-appliances":
      return <Armchair {...props} />;
    case "fashion":
      return <Shirt {...props} />;
    case "cameras":
      return <Camera {...props} />;
    default:
      return <Package {...props} />;
  }
}

/** Pastel pair per category: gradient from/to (CSS variable names) and a flat tint class for photo backdrops. */
const THEME: Record<string, { from: string; to: string; tint: string }> = {
  mobiles: { from: "sky", to: "lilac", tint: "tint-sky" },
  laptops: { from: "lilac", to: "sky", tint: "tint-lilac" },
  audio: { from: "peach", to: "butter", tint: "tint-peach" },
  watches: { from: "butter", to: "peach", tint: "tint-butter" },
  "home-appliances": { from: "mint", to: "sky", tint: "tint-mint" },
  fashion: { from: "peach", to: "lilac", tint: "tint-peach" },
};
const FALLBACK_THEME = { from: "butter", to: "mint", tint: "tint-butter" };
const themeFor = (slug?: string | null) => (slug && THEME[slug]) || FALLBACK_THEME;

/** Soft pastel backdrop class for a product photo (light: category pastel, dark: light tile). */
export function categoryTint(slug?: string | null) {
  return themeFor(slug).tint;
}

const INK = "fill-ink";
const PAPER = "fill-surface";

/** Flat illustration per category, drawn in code (no image files). */
function Art({ slug }: { slug?: string | null }) {
  switch (slug) {
    case "mobiles":
      return (
        <>
          <rect x="38" y="12" width="44" height="96" rx="10" className={INK} />
          <rect x="42" y="20" width="36" height="76" rx="5" className={PAPER} />
          <rect x="47" y="30" width="26" height="8" rx="4" className="fill-emerald-500" />
          <rect x="47" y="46" width="20" height="5" rx="2.5" className="fill-slate-300" />
          <rect x="47" y="56" width="26" height="22" rx="5" className="fill-highlight" />
          <circle cx="60" cy="102" r="2.5" className="fill-slate-400" />
        </>
      );
    case "laptops":
      return (
        <>
          <rect x="24" y="28" width="72" height="50" rx="6" className={INK} />
          <rect x="28" y="32" width="64" height="42" rx="3" className={PAPER} />
          <rect x="34" y="40" width="26" height="6" rx="3" className="fill-emerald-500" />
          <rect x="34" y="52" width="40" height="4" rx="2" className="fill-slate-300" />
          <rect x="66" y="58" width="20" height="10" rx="3" className="fill-highlight" />
          <path d="M14 82h92l-6 12a4 4 0 0 1-3.6 2.2H23.6A4 4 0 0 1 20 94z" className={INK} />
        </>
      );
    case "audio":
      return (
        <>
          <path d="M30 70V58a30 30 0 0 1 60 0v12" fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-slate-900" />
          <rect x="22" y="62" width="20" height="34" rx="9" className={INK} />
          <rect x="78" y="62" width="20" height="34" rx="9" className={INK} />
          <rect x="27" y="68" width="10" height="22" rx="5" className="fill-highlight" />
          <rect x="83" y="68" width="10" height="22" rx="5" className="fill-highlight" />
        </>
      );
    case "watches":
      return (
        <>
          <rect x="45" y="8" width="30" height="104" rx="9" className="fill-slate-700" />
          <rect x="30" y="34" width="60" height="52" rx="16" className={INK} />
          <rect x="35" y="39" width="50" height="42" rx="12" className={PAPER} />
          <path d="M60 48v13l9 6" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="stroke-slate-900" />
          <circle cx="60" cy="60" r="3" className="fill-highlight" />
          <rect x="88" y="55" width="5" height="10" rx="2.5" className="fill-slate-700" />
        </>
      );
    case "home-appliances":
      return (
        <>
          <rect x="26" y="26" width="68" height="76" rx="22" className={INK} />
          <rect x="34" y="34" width="52" height="30" rx="14" className="fill-slate-700" />
          <circle cx="60" cy="49" r="9" className="fill-highlight" />
          <rect x="40" y="78" width="40" height="8" rx="4" className="fill-slate-500" />
          <circle cx="76" cy="92" r="3" className="fill-emerald-500" />
          <rect x="34" y="102" width="52" height="6" rx="3" className="fill-slate-300" />
        </>
      );
    case "fashion":
      return (
        <>
          <path d="M14 78c0-6 4-10 10-10h14l8-14c2-3 6-3 8 0l4 6 10 4c10 3 26 8 40 8 6 0 10 4 10 10v6H14z" className={INK} />
          <path d="M14 90h92v6a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" className={PAPER} />
          <path d="M44 62l4 6M52 58l4 7M60 61l3 6" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-surface" />
          <circle cx="28" cy="76" r="4" className="fill-highlight" />
        </>
      );
    default:
      return (
        <>
          <path d="M60 14l38 20v44L60 106 22 78V34z" className={INK} />
          <path d="M60 14l38 20-38 20-38-20z" className="fill-slate-700" />
          <path d="M60 54v52" strokeWidth="3" className="stroke-slate-700" />
          <rect x="52" y="62" width="16" height="8" rx="3" className="fill-highlight" />
        </>
      );
  }
}

/** Gradient tile with a category illustration: shown when a product has no image or it fails to load. */
export function CategoryTile({ category, label, className }: { category?: string | null; label: string; className?: string }) {
  const t = themeFor(category);
  return (
    <div
      role="img"
      aria-label={label}
      className={clsx("flex items-center justify-center overflow-hidden", className)}
      style={{ backgroundImage: `linear-gradient(135deg, rgb(var(--${t.from})), rgb(var(--${t.to})))` }}
    >
      <svg viewBox="0 0 120 120" className="h-3/5 w-3/5 max-h-44 max-w-44 drop-shadow-[0_10px_14px_rgba(60,40,10,0.18)]" aria-hidden>
        <Art slug={category} />
      </svg>
    </div>
  );
}

interface Props {
  src: string | null | undefined;
  alt: string;
  category?: string | null;
  className?: string;
  /** "contain" for product photos on white, "cover" for banners */
  fit?: "contain" | "cover";
}

/** Product photo (multiply-blended on its backdrop in light mode, on a light tile in dark mode), or a category tile when there is no image. */
export function ProductImage({ src, alt, category, className, fit = "contain" }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  if (!showImage) return <CategoryTile category={category} label={alt} className={className} />;
  return (
    // Store CDNs are external; a plain <img> keeps remote-host configuration out of the app.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src as string}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src as string)}
      className={clsx("photo", fit === "contain" ? "object-contain" : "object-cover", className)}
    />
  );
}
