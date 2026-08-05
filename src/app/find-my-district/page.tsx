import { Metadata } from "next";
import FindMyDistrictClient from "@/components/features/FindMyDistrictClient";

const BASE_URL = "https://choseno.com";

export const metadata: Metadata = {
  title: "Find Your District & Constituency | Choseno",
  description:
    "Find which electoral district, riding, or constituency you belong to — polling district, municipal, provincial/state, and federal — no account required.",
  alternates: { canonical: `${BASE_URL}/find-my-district` },
  openGraph: {
    title: "Find Your District & Constituency | Choseno",
    description:
      "Find which electoral district, riding, or constituency you belong to — no account required.",
    url: `${BASE_URL}/find-my-district`,
    siteName: "Choseno",
    type: "website",
  },
};

export default function FindMyDistrictPage() {
  return <FindMyDistrictClient />;
}
