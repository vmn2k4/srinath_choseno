import React, { useEffect, useRef, useState } from 'react';
import { useScroll, useTransform, motion } from 'framer-motion';

// Adapted from Aceternity UI's Container Scroll Animation
// (ui.aceternity.com/components/container-scroll-animation) — a device
// frame that tilts flat and scales up as it scrolls into view.
export function ContainerScroll({ titleComponent, children }) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const scaleDimensions = isMobile ? [0.7, 0.9] : [1.05, 1];

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions);
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div ref={containerRef} className="h-[50rem] md:h-[70rem] flex items-center justify-center relative p-2 md:p-20">
      <div className="py-10 md:py-40 w-full relative" style={{ perspective: '1000px' }}>
        <ScrollHeader translate={translate}>{titleComponent}</ScrollHeader>
        <ScrollCard rotate={rotate} scale={scale}>
          {children}
        </ScrollCard>
      </div>
    </div>
  );
}

function ScrollHeader({ translate, children }) {
  return (
    <motion.div style={{ translateY: translate }} className="max-w-5xl mx-auto text-center mb-8 md:mb-12">
      {children}
    </motion.div>
  );
}

function ScrollCard({ rotate, scale, children }) {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow: 'var(--shadow-floating)',
      }}
      className="max-w-5xl mx-auto h-[26rem] md:h-[36rem] w-full border-4 border-border-light/60 p-2 md:p-6 bg-surface rounded-[30px]"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl bg-background md:rounded-2xl">
        {children}
      </div>
    </motion.div>
  );
}
