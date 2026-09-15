import { Metadata } from "next";
import SetLocationClient from "@/components/features/SetLocationClient";

export const metadata: Metadata = {
  title: "Set Your Location | Choseno",
  robots: { index: false, follow: false },
};

export default async function SetLocationPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return <SetLocationClient nextPath={nextPath} />;
}
