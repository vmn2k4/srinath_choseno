import { Metadata } from "next";
import FindMyDistrictClient from "@/components/features/FindMyDistrictClient";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

export const metadata: Metadata = {
  title: "Who Represents Me? Find My District & 2026 Candidates | Choseno",
  description:
    "Enter your address or ZIP code to instantly find your congressional district, state senate seat, and all 2026 candidates on your ballot. Free, no login needed.",
  alternates: { canonical: `${BASE_URL}/find-my-district` },
  openGraph: {
    title: "Who Represents Me? Find My District & 2026 Candidates | Choseno",
    description:
      "Enter your address or ZIP code to instantly find your congressional district, state senate seat, and all 2026 candidates on your ballot. Free, no login needed.",
    url: `${BASE_URL}/find-my-district`,
    siteName: "Choseno",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Who Represents Me? Find My District & 2026 Candidates | Choseno",
    description:
      "Enter your address or ZIP code to instantly find your congressional district and all 2026 candidates on your ballot.",
  },
};

export default function FindMyDistrictPage() {
  return <FindMyDistrictClient />;
}
