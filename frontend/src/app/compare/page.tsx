import { Suspense } from "react";
import type { Metadata } from "next";
import { CompareView } from "@/components/compare/CompareView";

export const metadata: Metadata = { title: "Compare products" };

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="page"><div className="skeleton h-96 w-full" /></div>}>
      <CompareView />
    </Suspense>
  );
}
