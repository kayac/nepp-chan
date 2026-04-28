import { useEffect, useRef } from "react";

type Dot = {
  kind: "dot";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  opacity: number;
  born: number;
  wobbleAmp: number;
  wobbleFreq: number;
  phase: number;
};

type Flake = {
  kind: "flake";
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  opacity: number;
  born: number;
  age: number;
  life: number;
  wobbleAmp: number;
  wobbleFreq: number;
  phase: number;
};

type Particle = Dot | Flake;

const MAX_DOTS = 30;
const MAX_FLAKES = 6;
const DOT_SPAWN_MS = 600;

const FLAKE_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none">
    <g stroke="#2dd4bf" stroke-width="1.6" stroke-linecap="round">
      <line x1="12" y1="2" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
      <path d="M9 3.5 L12 6 L15 3.5"/>
      <path d="M9 20.5 L12 18 L15 20.5"/>
      <path d="M3.5 9 L6 12 L3.5 15"/>
      <path d="M20.5 9 L18 12 L20.5 15"/>
    </g>
  </svg>`;

const DOT_PALETTE: ReadonlyArray<{ color: string; opacity: number }> = [
  { color: "#5eead4", opacity: 0.85 },
  { color: "#9ec7d6", opacity: 0.95 },
  { color: "#d9b58e", opacity: 0.9 },
  { color: "#a8bf9a", opacity: 0.9 },
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: ReadonlyArray<T>): T =>
  arr[Math.floor(Math.random() * arr.length)];

/** Canvas 2D ベースの雪 + ドットパーティクル */
const ParticleField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Snowflake は事前に Image にラスタライズして drawImage で再利用
    const flakeImg = new Image();
    let flakeReady = false;
    flakeImg.onload = () => {
      flakeReady = true;
    };
    flakeImg.src = `data:image/svg+xml;utf8,${encodeURIComponent(FLAKE_SVG)}`;

    const particles: Particle[] = [];
    let dotCount = 0;
    let flakeCount = 0;
    let lastDotSpawn = 0;

    const spawnDot = (): Dot => {
      const c = pick(DOT_PALETTE);
      return {
        kind: "dot",
        x: rand(0, w),
        y: -20,
        vx: rand(-6, 6),
        vy: rand(18, 38),
        r: pick([2, 3, 3, 4]),
        color: c.color,
        opacity: c.opacity,
        born: performance.now(),
        wobbleAmp: rand(6, 18),
        wobbleFreq: rand(0.3, 0.9),
        phase: rand(0, Math.PI * 2),
      };
    };

    const spawnFlake = (): Flake => ({
      kind: "flake",
      x: rand(0, Math.max(1, w)),
      y: rand(0, Math.max(1, h * 0.75)),
      vx: rand(-3, 3),
      vy: rand(-2, 2),
      size: Math.round(rand(14, 28)),
      rot: rand(-10, 10),
      vrot: rand(-4, 4),
      opacity: rand(0.6, 0.85),
      born: performance.now(),
      age: 0,
      life: rand(10, 18),
      wobbleAmp: rand(4, 10),
      wobbleFreq: rand(0.08, 0.2),
      phase: rand(0, Math.PI * 2),
    });

    for (let i = 0; i < MAX_FLAKES; i++) {
      particles.push(spawnFlake());
      flakeCount++;
    }

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (now - lastDotSpawn > DOT_SPAWN_MS && dotCount < MAX_DOTS) {
        lastDotSpawn = now;
        particles.push(spawnDot());
        dotCount++;
      }

      ctx.clearRect(0, 0, w, h);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        let alive = true;

        if (p.kind === "dot") {
          p.y += p.vy * dt;
          const wobble =
            Math.sin((now / 1000) * p.wobbleFreq * Math.PI * 2 + p.phase) *
            p.wobbleAmp;
          const x = p.x + p.vx * ((now - p.born) / 1000) + wobble;
          const ageFade = Math.min(1, (now - p.born) / 600);
          const bottomFade = Math.max(0, Math.min(1, (h - p.y) / 120));
          const op = p.opacity * ageFade * bottomFade;

          if (op > 0.01) {
            ctx.globalAlpha = op;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
          }

          if (p.y > h + 20 || x < -40 || x > w + 40) alive = false;
        } else {
          p.age += dt;
          const wobbleX =
            Math.sin((now / 1000) * p.wobbleFreq * Math.PI * 2 + p.phase) *
            p.wobbleAmp;
          const wobbleY =
            Math.cos(
              (now / 1000) * p.wobbleFreq * Math.PI * 2 * 0.7 + p.phase,
            ) *
            (p.wobbleAmp * 0.6);
          const x = p.x + p.vx * p.age + wobbleX;
          const y = p.y + p.vy * p.age + wobbleY;
          const rot = p.rot + p.vrot * p.age;

          let op = p.opacity;
          if (p.age < 1) op = p.opacity * p.age;
          else if (p.age > p.life - 1.5)
            op = p.opacity * Math.max(0, (p.life - p.age) / 1.5);

          if (flakeReady && op > 0.01) {
            ctx.save();
            ctx.globalAlpha = op;
            ctx.translate(x + p.size / 2, y + p.size / 2);
            ctx.rotate((rot * Math.PI) / 180);
            ctx.drawImage(flakeImg, -p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
          }

          if (
            p.age >= p.life ||
            x < -p.size * 2 ||
            x > w + p.size ||
            y < -p.size * 2 ||
            y > h + p.size
          ) {
            alive = false;
          }
        }

        if (!alive) {
          if (p.kind === "dot") dotCount--;
          else flakeCount--;
          particles.splice(i, 1);
        }
      }

      while (flakeCount < MAX_FLAKES) {
        particles.push(spawnFlake());
        flakeCount++;
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (rafRef.current) return;
      last = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      tabIndex={-1}
      aria-hidden="true"
      className="absolute inset-0 z-[1] w-full h-full pointer-events-none"
    />
  );
};

/** 冬景色の背景画像 + パーティクル (雪 + ドット) */
export const AmbientBG = () => (
  <div
    className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    aria-hidden="true"
  >
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: 'url("/bg-winter.png")',
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center bottom",
        backgroundSize: "cover",
      }}
    />
    <ParticleField />
  </div>
);
