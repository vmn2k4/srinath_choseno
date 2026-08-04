import { Metadata } from "next";
import ThemeAdminClient from "@/components/features/ThemeAdminClient";

export const metadata: Metadata = {
  title: "Site Theme Admin | Choseno",
  description: "Select global platform design system theme and color mode.",
};

export default function ThemeAdminPage() {
  return <ThemeAdminClient />;
}
