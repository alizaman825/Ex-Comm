"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";
import { detectCaps } from "@/lib/motion";

/**
 * Giant outlined word that sits behind the content of a scene. Sized by character count so long
 * words (SELL SMARTER) still fit the viewport without horizontal scroll.
 */
export function GiantWord({ children, className }: { children: string; className?: string }) {
  const size = `min(15rem, calc(94vw / ${(children.length * 0.6).toFixed(2)}))`;
  return (
    <div aria-hidden data-word className={clsx("pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-display font-extrabold uppercase leading-[0.8] tracking-[-0.05em] text-ink/[0.09]", className)} style={{ fontSize: size }}>
      {children}
    </div>
  );
}

/** The CSS price tag, shown while the 3D tag loads, when WebGL is unavailable, or when motion is reduced. */
export function StaticTag({ price, className }: { price: string; className?: string }) {
  const [rs, ...rest] = price.split(" ");
  return (
    <div className={clsx("relative mx-auto aspect-[11/16] w-full max-w-[15rem] rotate-[8deg]", className)} role="img" aria-label={`Lowest price tag: ${price}`}>
      <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-br from-[#FFE98C] via-[#FFD84D] to-[#F2B705] shadow-float ring-1 ring-white/50" />
      <div className="absolute inset-x-0 top-[7%] mx-auto h-5 w-5 rounded-full bg-canvas shadow-inner" />
      <div className="absolute inset-x-0 top-[28%] text-center font-display font-extrabold text-[#17140F]">
        <p className="text-[0.7rem] tracking-[0.18em]">LOWEST PRICE</p>
        <p className="mt-3 text-lg text-[#0B8A55]">{rs}</p>
        <p data-tag-number className="text-[2.1rem] leading-none tracking-tight">
          {rest.join(" ")}
        </p>
        <div className="mx-auto mt-5 h-0 w-0 border-x-[1.1rem] border-t-[1.5rem] border-x-transparent border-t-[#0FA968]" />
      </div>
    </div>
  );
}

/** Fades and lifts its children in when they scroll into view (staggered with `index`). Visible immediately when motion is off. */
export function RiseIn({ children, index = 0, className, style }: { children: ReactNode; index?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "armed" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || !detectCaps().motion) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // already on screen
    setState("armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={clsx("transition duration-700 ease-soft", state === "armed" && "translate-y-16 opacity-0", className)}
      style={{ transitionDelay: state === "shown" ? `${index * 90}ms` : undefined, ...style }}
    >
      {children}
    </div>
  );
}
