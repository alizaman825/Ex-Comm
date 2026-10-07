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

interface Props {
  src: string | null | undefined;
  alt: string;
  category?: string | null;
  className?: string;
  /** "contain" for product photos on white, "cover" for banners */
  fit?: "contain" | "cover";
}

/** Product photo with a tinted category-icon placeholder when there is no image or it fails to load. */
export function ProductImage({ src, alt, category, className, fit = "contain" }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  if (!showImage) {
    return (
      <div className={clsx("flex items-center justify-center bg-gradient-to-br from-slate-100 to-brand-50 text-brand-300", className)} role="img" aria-label={alt}>
        <CategoryIcon slug={category} className="h-1/3 w-1/3" strokeWidth={1.25} />
      </div>
    );
  }
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
      className={clsx("bg-surface", fit === "contain" ? "object-contain" : "object-cover", className)}
    />
  );
}
