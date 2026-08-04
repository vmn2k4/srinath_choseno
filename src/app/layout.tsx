import type { Metadata } from "next";
import { Public_Sans, Big_Shoulders } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NavBar from "@/components/NavBar";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Google Fonts merged the old separate "Big Shoulders Display" family into
// the single variable "Big Shoulders" superfamily -- next/font/google's
// font list (google-fonts-metadata.js) only recognizes the merged name.
const bigShouldersDisplay = Big_Shoulders({
  variable: "--font-big-shoulders-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Choseno — A Framework for Future Democracy",
  description:
    "An anonymous civic social platform. Post under a rotating Ghost ID, scoped automatically to your real electoral and administrative boundaries.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${bigShouldersDisplay.variable}`}>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              <NavBar />
              <main className="flex-1 w-full">{children}</main>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
