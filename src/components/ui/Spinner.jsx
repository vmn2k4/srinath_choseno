import React from 'react';

// Centralized loading spinner. Previously 3 incompatible idioms existed
// (a real ring spinner sized two different ways, a skeleton pulse block, and
// plain "Loading..." text with no animation at all in every admin panel).
const SIZES = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-4' };

export default function Spinner({ size = 'md', fullPage = false, className = '' }) {
  const spinner = (
    <div
      className={`${SIZES[size] || SIZES.md} border-primary/30 border-t-primary rounded-full animate-spin ${className}`.trim()}
    />
  );

  if (!fullPage) return spinner;

  return <div className="w-full flex items-center justify-center py-32">{spinner}</div>;
}
