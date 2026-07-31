import React from 'react';

// Centralized full-screen modal overlay recipe — previously copy-pasted
// verbatim (fixed inset-0 + scrim + centering) across CandidacyWall,
// PoliticianWall, FeedPage and EditProfileFlow. Panel content/styling stays
// with the caller via `children`; this only owns the overlay + centering.
export default function Modal({
  children,
  className = '',
  overlayClassName = 'bg-overlay backdrop-blur-sm',
  zIndexClassName = 'z-50',
  onOverlayClick,
}) {
  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} ${overlayClassName} flex items-center justify-center p-4`.trim()}
      onClick={onOverlayClick}
    >
      <div className={className} onClick={onOverlayClick ? (e) => e.stopPropagation() : undefined}>
        {children}
      </div>
    </div>
  );
}
