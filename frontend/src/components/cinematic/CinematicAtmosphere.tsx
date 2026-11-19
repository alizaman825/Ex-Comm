"use client";

import { useEffect, useRef } from "react";
import { detectCaps } from "@/lib/motion";

/**
 * The cinematic theme's full-bleed backdrop: a dusk/sunset CSS gradient plus a few soft blurred
 * "glow" circles that drift slowly (CSS keyframes) and parallax gently on scroll (gsap, when motion
 * is allowed). Always mounted (fixed, behind everything, z-index -10); invisible and inert unless
 * `html[data-ui-theme="cinematic"]` — see globals.css. That keeps the classic theme byte-for-byte
 * unaffected and avoids a hydration mismatch between server and client themes.
 */
export function CinematicAtmosphere() {
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const caps = detectCaps();
    if (!caps.motion) return; // prefers-reduced-motion, data saver, or a low-power device: CSS drift only, no JS parallax
    let ctx: { kill: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const [{ default: gsap }, scrollTriggerMod] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      const ScrollTrigger = scrollTriggerMod.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      const glows = glowRefs.current.filter((g): g is HTMLDivElement => Boolean(g));
      const gctx = gsap.context(() => {
        glows.forEach((el, i) => {
          gsap.to(el, {
            yPercent: (i % 2 === 0 ? -1 : 1) * 18,
            ease: "none",
            scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.6 },
          });
        });
      }, rootRef);
      ctx = gctx;
    })();

    function onVisibility() {
      // Pause scroll-driven work while the tab is hidden (cheap on battery, nothing to see anyway).
      if (document.hidden) ScrollTriggerRefresh(false);
      else ScrollTriggerRefresh(true);
    }
    function ScrollTriggerRefresh(enable: boolean) {
      void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
        ScrollTrigger.getAll().forEach((st) => (enable ? st.enable() : st.disable(false)));
      });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      ctx?.kill();
    };
  }, []);

  return (
    <div ref={rootRef} className="atmo" aria-hidden="true">
      <div className="atmo-gradient" />
      <div ref={(el) => void (glowRefs.current[0] = el)} className="atmo-glow atmo-glow-a" />
      <div ref={(el) => void (glowRefs.current[1] = el)} className="atmo-glow atmo-glow-b" />
      <div ref={(el) => void (glowRefs.current[2] = el)} className="atmo-glow atmo-glow-c" />
    </div>
  );
}
