import { Metadata } from "next";
import ProfilePageClient from "@/components/features/ProfilePageClient";

export const metadata: Metadata = {
  title: "Account Settings & Profile | Choseno",
  description: "Manage your civic profile, Ghost ID identity, and electoral boundary memberships.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
