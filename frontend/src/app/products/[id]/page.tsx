import type { Metadata } from "next";
import { CinematicProductView } from "@/components/product/CinematicProductView";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CinematicProductView id={id} />;
}
