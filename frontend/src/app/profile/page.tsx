import type { Metadata } from "next";
import { AuthGate } from "@/components/account/AuthGate";
import { ProfileView } from "@/components/account/ProfileView";

export const metadata: Metadata = { title: "Profile & settings" };

export default function ProfilePage() {
  return (
    <AuthGate>
      <ProfileView />
    </AuthGate>
  );
}
