"use client";

import React, { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { SUPPORTED_LOCALES, Locale } from "@/lib/i18n/i18n";

export default function LanguageSwitcher({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentOption = SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-border-light/50 bg-surface-elevated/60 text-text-main hover:bg-surface-hover hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200 cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
        title="Change language"
      >
        <Globe size={16} className="text-primary" />
        <span>{compact ? currentOption.code.toUpperCase() : currentOption.nativeName}</span>
        <ChevronDown size={14} className={`text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-surface shadow-elevated-lg backdrop-blur-xl z-50 py-1 overflow-hidden animate-fade-in">
          <div className="px-3 py-1.5 text-xs font-semibold text-text-muted border-b border-border-light/30">
            Select Language
          </div>
          {SUPPORTED_LOCALES.map((option) => {
            const isSelected = option.code === locale;
            return (
              <button
                key={option.code}
                onClick={() => {
                  setLocale(option.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-text-main hover:bg-surface-hover"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{option.flag}</span>
                  <span>{option.nativeName}</span>
                </span>
                {isSelected && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
