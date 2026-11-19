"use client";

/**
 * The product image wrapper. Used to mount a real three.js/R3F tilt treatment on the product-detail
 * hero image, but that could only ever be verified in this sandbox against a placeholder icon, never
 * a real product photo (no network access to the store CDNs the real photos live on) — so, per the
 * product owner's explicit call, the 3D/R3F treatment has been removed rather than shipped unverified.
 * This renders the plain real photo; the pointer-driven tilt on it (and on every grid/rail card) is
 * the lightweight, CSS-only `[data-tilt]` effect in TiltEffect.tsx, not WebGL.
 *
 * No backing shape behind the photo either: this renders nothing beyond the plain <img> itself.
 */

import { ProductImage } from "@/components/product/ProductImage";

interface Props {
  src: string | null | undefined;
  alt: string;
  category?: string | null;
  className?: string;
}

export function ProductVisual({ src, alt, category, className }: Props) {
  return <ProductImage src={src} alt={alt} category={category} className={className} fit="contain" />;
}
