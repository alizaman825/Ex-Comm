import type { Metadata } from "next";
import { BestDealsView } from "@/components/deals/BestDealsView";

export const metadata: Metadata = {
  title: "Best deals",
  description: "Products currently at their biggest price drops across Daraz, PriceOye and more.",
};

export default function BestDealsPage() {
  return <BestDealsView />;
}
