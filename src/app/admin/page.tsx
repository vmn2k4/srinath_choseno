import { redirect } from "next/navigation";

// Admin landing page: analytics is what gets opened most, so /admin opens it.
// The boundaries tool that used to live here is now at /admin/boundaries.
export default function AdminIndexPage() {
  redirect("/admin/traffic");
}
