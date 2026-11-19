"use client";

/**
 * The product image "stage": a flat glass panel holding the photo, with a real three.js tilt/float
 * treatment mounted lazily when it's worth the cost (one per page, cinematic theme, WebGL + motion
 * allowed, in view), and a plain <img> + CSS tilt fallback everywhere else (classic theme, reduced
 * motion, low-end devices, grid cards, or while the 3D canvas has not mounted yet).
 *
 * No circular "bubble" here: the panel is a soft-cornered rectangle, like a thin glass card sitting
 * under the photo, not a ring wrapped around it.
 */

import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { useCaps } from "@/lib/motion";
import { ProductImage, categoryTint } from "@/components/product/ProductImage";

const ProductStage3D = dynamic(() => import("./ProductStage3D"), { ssr: false });

/** Catches a bad/missing texture (or any other R3F mount failure) and quietly falls back to the
 * plain <img>, instead of taking the whole product page down. */
class StageBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface Props {
  src: string | null | undefined;
  alt: string;
  category?: string | null;
  className?: string;
  /** mount the real R3F canvas here when caps allow it (hero / product-detail image only) */
  enable3d?: boolean;
}

/** True once the element has entered the viewport at least once (and stays true after, so the canvas
 * does not tear down every time the user scrolls a pixel past the edge). */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}

export function ProductVisual({ src, alt, category, className, enable3d = false }: Props) {
  const caps = useCaps();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [failed, setFailed] = useState(false);
  // cinematic-only: the 3D stage is part of this theme's look, not classic's. Read once per mount
  // (client-only component; the theme attribute is set before first paint by layout.tsx's inline
  // script, so this lazy initializer sees the right value on first render, no effect needed).
  const [cinematic] = useState(() => typeof document !== "undefined" && document.documentElement.getAttribute("data-ui-theme") === "cinematic");
  const can3d = enable3d && cinematic && Boolean(src) && !failed && caps?.webgl && caps?.motion;

  return (
    <div ref={ref} className={clsx("product-stage relative", className)}>
      {/* always-present fallback image: the real content for classic theme, reduced motion, no WebGL,
          and the loading state before the 3D canvas takes over */}
      <ProductImage
        src={src}
        alt={alt}
        category={category}
        className={clsx("h-full w-full transition-opacity duration-500", can3d && inView && "opacity-0")}
        fit="contain"
      />
      {can3d && inView && (
        <StageBoundary onFail={() => setFailed(true)}>
          <Suspense fallback={null}>
            <div className="absolute inset-0" aria-hidden>
              <ProductStage3D src={src as string} active={inView} />
            </div>
          </Suspense>
        </StageBoundary>
      )}
      {!can3d && <div className={clsx("pointer-events-none absolute inset-0 -z-10", categoryTint(category))} aria-hidden />}
    </div>
  );
}
