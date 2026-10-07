"use client";

import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { heroProgress } from "@/lib/motion";
import { formatPrice } from "@/lib/format";

gsap.registerPlugin(ScrollTrigger);

const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

/**
 * Scroll choreography for the landing page (loaded lazily, client only). It renders nothing: it finds
 * the landing markup by data attributes. Scenes are pinned with CSS sticky; GSAP ScrollTrigger scrubs
 * their timelines. Only the compare and track scenes are pinned, nothing else holds the scroll.
 */
export default function LandingMotion({ high, low }: { high: number; low: number }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.dataset.motion = "on"; // expands the .scene wrappers (see globals.css)

    const ctx = gsap.context(() => {
      /* ---- Hero: progress for the tag + parallax depth for the floating products ---- */
      const hero = q("[data-hero]")[0];
      if (hero) {
        const tagNumber = q("[data-tag-number]")[0];
        ScrollTrigger.create({
          trigger: hero,
          start: "top top",
          end: "bottom top",
          scrub: true,
          onUpdate: (self) => {
            heroProgress.value = self.progress;
            if (tagNumber) tagNumber.textContent = formatPrice(Math.round((high - (high - low) * (1 - Math.pow(1 - self.progress, 2))) / 10) * 10).replace(/^Rs /, "");
          },
        });
        for (const el of q("[data-float]", hero)) {
          const depth = Number(el.dataset.depth ?? 0.5);
          gsap.to(el, { y: -depth * 260, rotate: depth * 6 - 3, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.8 } });
        }
        gsap.fromTo(q("[data-float]", hero), { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 1, ease: "power3.out", stagger: 0.1, delay: 0.2 });
      }

      /* ---- Section headings fade up as they enter ---- */
      for (const el of q("[data-reveal]")) {
        gsap.fromTo(el, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      }

      /* ---- Compare (pinned): word, product, three price cards slide in, lowest turns green ---- */
      const cmp = q('[data-scene="compare"]')[0];
      if (cmp) {
        const tl = gsap.timeline({ defaults: { ease: "power2.out" }, scrollTrigger: { trigger: cmp, start: "top top", end: "bottom bottom", scrub: 0.7 } });
        const w = window.innerWidth;
        tl.fromTo(q("[data-word]", cmp), { scale: 0.86, opacity: 0.3 }, { scale: 1, opacity: 1, duration: 1 }, 0)
          .fromTo(q("[data-cmp-product]", cmp), { y: 90, scale: 0.7, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 1 }, 0.1)
          .fromTo(
            q("[data-cmp-card]", cmp),
            { x: (i, el) => Number((el as HTMLElement).dataset.from) * w * 0.7 || 0, y: (i, el) => (Number((el as HTMLElement).dataset.from) ? 0 : 140), opacity: 0 },
            { x: 0, y: 0, opacity: 1, duration: 1.2, stagger: 0.18 },
            0.7
          )
          .fromTo(q("[data-cmp-ring]", cmp), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 2.3)
          .fromTo(q("[data-cmp-best]", cmp), { scale: 1 }, { scale: 1.07, duration: 0.6, ease: "back.out(2)" }, 2.3)
          .fromTo(q("[data-cmp-badge]", cmp), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(3)" }, 2.5)
          .to({}, { duration: 0.8 }); // hold the final frame
      }

      /* ---- Track (pinned): the chart draws, the drop badge pops, the alert slides in ---- */
      const trk = q('[data-scene="track"]')[0];
      if (trk) {
        const line = q<SVGPathElement>("[data-track-line]", trk)[0];
        const len = line?.getTotalLength?.() ?? 1200;
        if (line) gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
        const tl = gsap.timeline({ defaults: { ease: "power2.out" }, scrollTrigger: { trigger: trk, start: "top top", end: "bottom bottom", scrub: 0.7 } });
        tl.fromTo(q("[data-word]", trk), { scale: 0.86, opacity: 0.3 }, { scale: 1, opacity: 1, duration: 1 }, 0)
          .fromTo(q("[data-track-line]", trk), { strokeDashoffset: len }, { strokeDashoffset: 0, ease: "none", duration: 2.4 }, 0.3)
          .fromTo(q("[data-track-area]", trk), { opacity: 0 }, { opacity: 1, duration: 1.2 }, 1.6)
          .fromTo(q("[data-track-dot]", trk), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(3)" }, 2.6)
          .fromTo(q("[data-track-badge]", trk), { scale: 0, rotate: -18, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.6, ease: "back.out(2.6)" }, 2.8)
          .fromTo(q("[data-track-alert]", trk), { y: 30, x: -20, opacity: 0 }, { y: 0, x: 0, opacity: 1, duration: 0.6 }, 3.3)
          .to({}, { duration: 0.8 });
      }

      /* ---- Sell: margin number counts up when it enters ---- */
      for (const el of q("[data-count]")) {
        const to = Number(el.dataset.to ?? 0);
        const obj = { v: 0 };
        el.textContent = "0";
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          once: true,
          onEnter: () => gsap.to(obj, { v: to, duration: 1.8, ease: "power2.out", onUpdate: () => (el.textContent = String(Math.round(obj.v))) }),
        });
      }
      gsap.from(q("[data-sell-card]"), { y: 60, opacity: 0, rotate: 3, duration: 1, ease: "power3.out", scrollTrigger: { trigger: "[data-sell-card]", start: "top 85%", once: true } });
    });

    // Layout shifts after data and fonts arrive: keep trigger positions honest.
    let t: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(t);
      t = setTimeout(() => ScrollTrigger.refresh(), 150);
    };
    const ro = new ResizeObserver(refresh);
    ro.observe(document.body);
    window.addEventListener("load", refresh);
    void document.fonts?.ready.then(refresh);
    refresh();

    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("load", refresh);
      ctx.revert();
      heroProgress.value = 0;
      delete html.dataset.motion;
    };
  }, [high, low]);

  return null;
}
