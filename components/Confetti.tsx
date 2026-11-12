'use client';
import { forwardRef, useImperativeHandle, useRef } from 'react';

export type ConfettiHandle = { burst: (count?: number) => void };

const COLORS = ['#ff6fa8', '#2ed3c6', '#ffd23f', '#ff9248', '#b388ff', '#ffffff'];

// Lightweight confetti burst. Skipped entirely when the player prefers reduced motion.
export const Confetti = forwardRef<ConfettiHandle>(function Confetti(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const running = useRef(false);
  const parts = useRef<any[]>([]);

  useImperativeHandle(ref, () => ({
    burst(count = 60) {
      if (typeof window === 'undefined') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const c = canvas.current;
      if (!c) return;
      const w = (c.width = window.innerWidth);
      const h = (c.height = window.innerHeight);
      for (let i = 0; i < count; i++) {
        parts.current.push({
          x: w / 2 + (Math.random() - 0.5) * w * 0.3,
          y: h * 0.35,
          vx: (Math.random() - 0.5) * 14,
          vy: -Math.random() * 14 - 4,
          r: Math.random() * 6 + 3,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: COLORS[i % COLORS.length],
          life: 0,
        });
      }
      if (running.current) return;
      running.current = true;
      const ctx = c.getContext('2d')!;
      const tick = () => {
        ctx.clearRect(0, 0, w, h);
        parts.current = parts.current.filter((p) => p.life < 140 && p.y < h + 20);
        for (const p of parts.current) {
          p.life++;
          p.vy += 0.35;
          p.vx *= 0.99;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, 1 - p.life / 140);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
          ctx.restore();
        }
        if (parts.current.length) requestAnimationFrame(tick);
        else {
          running.current = false;
          ctx.clearRect(0, 0, w, h);
        }
      };
      requestAnimationFrame(tick);
    },
  }));

  return <canvas ref={canvas} className="confetti" aria-hidden="true" />;
});
