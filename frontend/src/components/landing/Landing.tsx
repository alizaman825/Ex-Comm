"use client";

import dynamic from "next/dynamic";
import { useCaps } from "@/lib/motion";
import { useShowcase } from "./showcase";

// GSAP and ScrollTrigger load only when this device may animate, and only on the landing page.
const LandingMotion = dynamic(() => import("./LandingMotion"), { ssr: false });

/** Turns on the scroll choreography when the device allows it (not reduced motion, not low power). Renders nothing itself. */
export function LandingEffects() {
  const caps = useCaps();
  const showcase = useShowcase();
  if (!caps?.motion) return null;
  const tag = showcase?.tag ?? { high: 129_999, low: 117_999 };
  return <LandingMotion high={tag.high} low={tag.low} />;
}
