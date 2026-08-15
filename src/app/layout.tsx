import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import NavBar from "@/components/NavBar";
import SiteFooter from "@/components/SiteFooter";
import DebugUserSwitcher from "@/components/dev/DebugUserSwitcher";
import FakeProductionToggle from "@/components/dev/FakeProductionToggle";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";

import { SITE_URL } from "@/lib/constants/site";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const bigShouldersDisplay = localFont({
  src: "../../public/fonts/BigShouldersDisplay-Variable.woff2",
  variable: "--font-big-shoulders-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Choseno — Rate Politicians, Track Candidates & Live Civic News",
    template: "%s | Choseno",
  },
  description:
    "Empowering voters with verified civic journalism, real-time election coverage, and district-level politician accountability. Track your representatives and read authentic community reviews.",
  keywords: [
    "rate politicians",
    "elections 2026",
    "civic news",
    "local government updates",
    "city council decisions",
    "mayoral policy updates",
    "candidate reviews",
    "voter accountability",
    "district boundaries",
    "verified political news",
  ],
  authors: [{ name: "Choseno Civic News Desk", url: SITE_URL }],
  creator: "Choseno",
  publisher: "Choseno",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Choseno",
    title: "Choseno — Rate Politicians, Track Candidates & Live Civic News",
    description:
      "Empowering voters with verified civic journalism, real-time election coverage, and district-level politician accountability.",
    images: [
      {
        url: `${SITE_URL}/og-home.jpg`,
        width: 1200,
        height: 630,
        alt: "Choseno — Rate Your Politicians' Performance. Like Yelp, but for Democracy.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Choseno — Rate Politicians, Track Candidates & Live Civic News",
    description:
      "Empowering voters with verified civic journalism, real-time election coverage, and district-level politician accountability.",
    images: [`${SITE_URL}/og-home.jpg`],
  },
  verification: {
    other: {
      "msvalidate.01": "AECC25E231AF85530C43CA52A2B4E345",
    },
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${bigShouldersDisplay.variable}`}>
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              {/* pb-16 clears the fixed mobile bottom nav bar (NavBar renders
                  it lg:hidden) so page content and the footer never sit
                  underneath it; lg+ has no bottom bar so no padding needed. */}
              <div className="flex flex-col min-h-screen pb-16 lg:pb-0">
                <NavBar />
                <main className="flex-1 w-full pt-6 lg:pt-8">{children}</main>
                <SiteFooter />
              </div>
              {process.env.NODE_ENV !== "production" && (
                <>
                  <DebugUserSwitcher />
                  <FakeProductionToggle />
                </>
              )}
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
