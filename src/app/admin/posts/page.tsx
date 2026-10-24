import { Metadata } from "next";
import PostsAdminClient from "@/components/features/PostsAdminClient";

export const metadata: Metadata = {
  title: "Posts | Choseno Admin",
  description: "Every post made on the platform, newest first.",
  robots: { index: false, follow: false },
};

export default function PostsAdminPage() {
  return <PostsAdminClient />;
}
