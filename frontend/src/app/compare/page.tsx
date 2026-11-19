import { Suspense } from "react";
import type { Metadata } from "next";
import { CinematicCompareView } from "@/components/compare/CinematicCompareView";

export const metadata: Metadata = { title: "Compare products" };

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="page"><div className="skeleton h-96 w-full" /></div>}>
      <CinematicCompareView />
    </Suspense>
  );
}
