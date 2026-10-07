"use client";

import { useSyncExternalStore } from "react";

/** What the landing page may do on this device. Evaluated on the client only. */
export interface MotionCaps {
  /** scroll-driven animation allowed (no reduced-motion preference, no data saver, not a very low-power device) */
  motion: boolean;
  /** WebGL available and the device is powerful enough for the 3D price tag */
  webgl: boolean;
}

export function detectCaps(): MotionCaps {
  if (typeof window === "undefined") return { motion: false, webgl: false };
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const lowPower = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || nav.connection?.saveData === true;
  const motion = !reduced && !lowPower;
  let webgl = false;
  if (motion) {
    try {
      const c = document.createElement("canvas");
      webgl = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return { motion, webgl };
}

/** Shared scroll progress of the hero (0 to 1), written by the GSAP trigger and read by the 3D tag every frame. */
export const heroProgress = { value: 0 };

let cached: MotionCaps | null = null;
const noopSubscribe = () => () => {};
const snapshot = () => (cached ??= detectCaps());

/** Device capabilities for the landing page; null on the server and during hydration (so the first render is the static one). */
export function useCaps(): MotionCaps | null {
  return useSyncExternalStore(noopSubscribe, snapshot, () => null);
}
