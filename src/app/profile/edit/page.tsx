import { Metadata } from "next";
import EditProfileClient from "@/components/features/EditProfileClient";

export const metadata: Metadata = {
  title: "Edit Profile | Choseno",
  description: "Update your name, location, and (for politicians) public campaign details.",
};

export default function EditProfilePage() {
  return <EditProfileClient />;
}
