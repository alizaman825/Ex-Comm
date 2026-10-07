import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { CategoriesView } from "@/components/home/CategoriesView";

export const metadata: Metadata = { title: "Categories", description: "Browse mobiles, laptops, audio, watches, home appliances and fashion compared across stores." };

export default function CategoriesPage() {
  return (
    <div className="page">
      <PageHeader title="Browse by category" description="Pick a category to see every product compared across stores, or jump straight to a popular search." />
      <CategoriesView />
    </div>
  );
}
