"use client";

import { useEffect } from "react";
import { detectCaps } from "@/lib/motion";

const MAX_DEG = 8;

/**
 * A subtle pointer/touch tilt on any element marked `data-tilt`, used for the hero product visual.
 * Cinematic theme only, and only when motion is allowed (prefers-reduced-motion off, device capable).
 * One listener for the whole document — cheap, and there are only ever one or two tilt targets.
 */
export function TiltEffect() {
  useEffect(() => {
    if (!detectCaps().motion) return;

    function apply(x: number, y: number) {
      if (document.documentElement.getAttribute("data-ui-theme") !== "cinematic") return;
      document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (x < r.left - 80 || x > r.right + 80 || y < r.top - 80 || y > r.bottom + 80) return;
        const px = (x - r.left) / r.width - 0.5;
        const py = (y - r.top) / r.height - 0.5;
        el.style.transform = `rotateX(${(-py * MAX_DEG).toFixed(2)}deg) rotateY(${(px * MAX_DEG).toFixed(2)}deg)`;
      });
    }
    function reset() {
      document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => (el.style.transform = ""));
    }
    function onMove(e: PointerEvent) {
      apply(e.clientX, e.clientY);
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", reset, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", reset);
      reset();
    };
  }, []);

  return null;
}
