import type { Metadata } from "next";
import { ProductView } from "@/components/product/ProductView";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductView id={id} />;
}
