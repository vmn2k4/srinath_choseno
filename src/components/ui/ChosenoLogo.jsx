import React from 'react';

/**
 * Choseno Logo Component (Orange Edition with Center Dot)
 * Concept:
 * - Top Forward Arrow arc swooping right over the "Chosen" section.
 * - Bottom Reverse Arrow arc curving down from the "o" section.
 * - Center Eye Dot focal point.
 * - Color Scheme: Vibrant Orange branding (#f97316 / #ea580c).
 * 
 * Props:
 * - size: 'sm' | 'md' | 'lg' | 'xl'
 * - showText: boolean (default: true)
 * - className: string
 */
export default function ChosenoLogo({ size = 'md', showText = true, className = '' }) {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 font-display font-extrabold tracking-tight select-none ${className}`}>
      {/* SVG Icon Emblem */}
      <svg
        className={`${iconSizes[size] || iconSizes.md} shrink-0 transition-transform duration-300 hover:scale-105 drop-shadow-[0_2px_8px_rgba(249,115,22,0.35)]`}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Choseno Logo Icon"
      >
        <defs>
          <linearGradient id="choseno-orange-top" x1="4" y1="8" x2="44" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ff8c00" />
          </linearGradient>
          <linearGradient id="choseno-orange-bottom" x1="44" y1="28" x2="8" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        {/* Top Forward Arrow Arc (Swooping Over) */}
        <path
          d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z"
          fill="url(#choseno-orange-top)"
        />

        {/* Bottom Reverse Arrow Arc (Looping Down) */}
        <path
          d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z"
          fill="url(#choseno-orange-bottom)"
        />

        {/* Center Eye Element: White outer ring + Dark Slate center dot pupil */}
        <circle cx="24" cy="24" r="6" fill="#ffffff" />
        <circle cx="24" cy="24" r="3.5" fill="#0f172a" />
      </svg>

      {/* Wordmark */}
      {showText && (
        <span className={`${textSizes[size] || textSizes.md} flex items-center leading-none tracking-tight`}>
          <span className="text-orange-500 hover:text-orange-400 transition-colors">Chosen</span>
          <span className="text-amber-500 hover:text-orange-400 transition-colors">o</span>
        </span>
      )}
    </div>
  );
}
