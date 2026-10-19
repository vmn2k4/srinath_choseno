import { useEffect, useState } from "react";

// On big monitors we scale pages up gently with CSS `zoom` (rather than bumping a few
// font sizes, which leaves the layout floating in a huge empty canvas). The zoom is
// deliberately mild (layout stays ~1800px wide, not 1440px) so text doesn't feel
// oversized; the content containers widen at min-[1700px] to fill the rest. Below SCALE_FROM_PX the
// zoom is exactly 1, so laptops and phones are untouched. CSS `zoom` shrinks the
// layout viewport the element lays out in (width becomes vw / zoom), so the layout
// it resolves is ~DESIGN_WIDTH_PX wide.
const DESIGN_WIDTH_PX = 1800;
const SCALE_FROM_PX = 1700;
const MAX_ZOOM = 2.6;

export function computeViewportZoom(viewportWidth: number): number {
  if (viewportWidth < SCALE_FROM_PX) return 1;
  return Math.min(MAX_ZOOM, Math.max(1, viewportWidth / DESIGN_WIDTH_PX));
}

export function useViewportZoom(): number {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setZoom(computeViewportZoom(window.innerWidth)));
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, []);

  return zoom;
}
