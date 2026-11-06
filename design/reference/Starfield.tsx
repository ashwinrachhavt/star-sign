'use client';

import { useEffect, useRef } from 'react';

/**
 * Starfield — the Void's living archive. Slow-drifting white dots that twinkle;
 * the archive of everything that ever decayed here.
 */
export function Starfield({ density = 70, className = '' }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const stars = Array.from({ length: density }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.1,
      speed: 0.00002 + Math.random() * 0.00008,
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.0012 + Math.random() * 0.002,
      bright: i % 11 === 0,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y -= s.speed * 16;
        if (s.y < -0.02) s.y = 1.02;
        const a = 0.18 + 0.5 * Math.abs(Math.sin(t * s.twinkle + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(242,242,240,${(s.bright ? a + 0.25 : a).toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [density]);

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden />;
}
