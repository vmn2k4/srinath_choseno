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
  title: "Choseno — Rate Your Politician & See 2026 Candidate Reviews",
  description:
    "Like Yelp, but for democracy. Rate your senators, representatives & local politicians. Read what voters in your district are saying — anonymously, free.",
  authors: [{ name: "Murugappan Valliyappan", url: "https://www.linkedin.com/in/muruvalliyappan/" }],
  creator: "Murugappan Valliyappan",
  publisher: "Choseno",
  verification: {
    other: {
      "msvalidate.01": "AECC25E231AF85530C43CA52A2B4E345",
    },
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
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
