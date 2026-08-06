import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/admin");
  }

  // Check if user has admin role
  const { data: profile } = await getProfileRole(supabase, user.id);

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return <>{children}</>;
}
