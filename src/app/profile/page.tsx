import { Metadata } from "next";
import ProfilePageClient from "@/components/features/ProfilePageClient";

export const metadata: Metadata = {
  title: "Account Settings & Profile | Choseno",
  description: "Manage your civic profile, Ghost ID identity, and electoral boundary memberships.",
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
