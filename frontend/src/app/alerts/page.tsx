import type { Metadata } from "next";
import { AuthGate } from "@/components/account/AuthGate";
import { AlertsView } from "@/components/account/AlertsView";

export const metadata: Metadata = { title: "Price alerts" };

export default function AlertsPage() {
  return (
    <AuthGate>
      <AlertsView />
    </AuthGate>
  );
}
