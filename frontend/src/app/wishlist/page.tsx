import type { Metadata } from "next";
import { AuthGate } from "@/components/account/AuthGate";
import { WishlistView } from "@/components/account/WishlistView";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <AuthGate>
      <WishlistView />
    </AuthGate>
  );
}
