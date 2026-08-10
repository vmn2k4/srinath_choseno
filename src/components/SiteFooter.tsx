import Link from "next/link";
import { Heart } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-border bg-background mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
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

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2">
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

        <p className="text-center sm:text-right">
          &copy; {new Date().getFullYear()} Choseno. Independent &amp; non-partisan.
        </p>
      </div>
    </footer>
  );
}
