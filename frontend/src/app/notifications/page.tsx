import type { Metadata } from "next";
import { AuthGate } from "@/components/account/AuthGate";
import { NotificationsView } from "@/components/account/NotificationsView";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <AuthGate>
      <NotificationsView />
    </AuthGate>
  );
}
