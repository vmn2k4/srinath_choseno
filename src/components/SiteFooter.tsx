import Link from "next/link";
import { Heart } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-border bg-background mt-auto">
      {/* Below sm: stack all sections vertically. sm-lg: credit + nav side-by-side, copyright below. lg+: all three in a row. */}
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4 text-xs text-text-muted">
        {/* Credit line — wraps and centers on mobile, left-aligned on sm+ */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
          <span>Built with</span>
          <Heart size={11} className="text-primary fill-primary" />
          <span>by an everyday citizen —</span>
          <a
            href="https://www.linkedin.com/in/muruvalliyappan/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            Murugappan Valliyappan
          </a>
        </div>

        {/* Navigation links — wrap at each link on mobile, inline on sm+ */}
        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-5">
          <Link href="/about" className="hover:text-text-main hover:underline transition-colors">
            About
          </Link>
          <Link href="/about#editorial-heading" className="hover:text-text-main hover:underline transition-colors">
            Editorial Standards
          </Link>
          <Link href="/privacy" className="hover:text-text-main hover:underline transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-text-main hover:underline transition-colors">
            Terms of Service
          </Link>
          <a
            href="mailto:contact@choseno.com"
            className="hover:text-text-main hover:underline transition-colors"
          >
            Contact
          </a>
        </nav>

        {/* Copyright — centered on all sizes for consistency */}
        <p className="text-center">
          &copy; {new Date().getFullYear()} Choseno. Independent &amp; non-partisan.
        </p>
      </div>
    </footer>
  );
}
