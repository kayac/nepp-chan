import { useEffect, useRef } from "react";

type Particle = {
  el: HTMLSpanElement;
  kind: "dot" | "flake";
  x: number;
  y: number;
  vy: number;
  vx: number;
  wobbleAmp: number;
  wobbleFreq: number;
  phase: number;
  size?: number;
  rot?: number;
  vrot?: number;
  targetOp: number;
  born: number;
  age: number;
  life?: number;
  dead: boolean;
};

const ParticleField = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const poolRef = useRef<Particle[]>([]);
  const lastSpawnRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const MAX_DOTS = 30;
    const MAX_FLAKES = 6;
    const DOT_SPAWN_MS = 600;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = <T,>(arr: T[]): T =>
      arr[Math.floor(Math.random() * arr.length)];

    const measure = () => {
      const rect = root.getBoundingClientRect();
      sizeRef.current.w = rect.width;
      sizeRef.current.h = rect.height;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);

    const destroy = (p: Particle) => {
      if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
      p.dead = true;
    };

    const spawnDot = (): Particle | undefined => {
      const { w } = sizeRef.current;
      if (!w) return undefined;
      const palette = [
        { bg: "var(--teal-400)", op: 0.85 },
        { bg: "#9ec7d6", op: 0.95 },
        { bg: "#d9b58e", op: 0.9 },
        { bg: "#a8bf9a", op: 0.9 },
      ];
      const c = pick(palette);
      const size = pick([4, 6, 6, 8]);
      const el = document.createElement("span");
      el.className =
        "absolute top-0 left-0 rounded-full will-change-[transform,opacity]";
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = c.bg;
      el.style.opacity = "0";
      root.appendChild(el);
      return {
        el,
        kind: "dot",
        x: rand(0, w),
        y: -20,
        vy: rand(18, 38),
        vx: rand(-6, 6),
        wobbleAmp: rand(6, 18),
        wobbleFreq: rand(0.3, 0.9),
        phase: rand(0, Math.PI * 2),
        targetOp: c.op,
        born: performance.now(),
        age: 0,
        dead: false,
      };
    };

    const spawnFlake = (): Particle | undefined => {
      const { w, h } = sizeRef.current;
      if (!w) return undefined;
      const size = Math.round(rand(14, 28));
      const el = document.createElement("span");
      el.className = "absolute top-0 left-0 will-change-[transform,opacity]";
      el.style.opacity = "0";
      el.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block">
          <g stroke="var(--teal-400)" stroke-width="1.6" stroke-linecap="round">
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
      root.appendChild(el);
      return {
        el,
        kind: "flake",
        size,
        x: rand(0, w - size),
        y: rand(0, Math.max(0, h * 0.75)),
        vy: rand(-2, 2),
        vx: rand(-3, 3),
        wobbleAmp: rand(4, 10),
        wobbleFreq: rand(0.08, 0.2),
        phase: rand(0, Math.PI * 2),
        rot: rand(-10, 10),
        vrot: rand(-4, 4),
        targetOp: rand(0.6, 0.85),
        life: rand(10, 18),
        age: 0,
        born: performance.now(),
        dead: false,
      };
    };

    for (let i = 0; i < MAX_FLAKES; i++) {
      const p = spawnFlake();
      if (p) poolRef.current.push(p);
    }

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = sizeRef.current;

      if (now - lastSpawnRef.current > DOT_SPAWN_MS) {
        lastSpawnRef.current = now;
        const dotCount = poolRef.current.filter((p) => p.kind === "dot").length;
        if (dotCount < MAX_DOTS) {
          const p = spawnDot();
          if (p) poolRef.current.push(p);
        }
      }

      const pool = poolRef.current;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (p.dead) continue;

        if (p.kind === "dot") {
          p.y += p.vy * dt;
          const wobble =
            Math.sin((now / 1000) * p.wobbleFreq * Math.PI * 2 + p.phase) *
            p.wobbleAmp;
          const x = p.x + p.vx * ((now - p.born) / 1000) + wobble;
          const ageFade = Math.min(1, (now - p.born) / 600);
          const bottomFade = Math.max(0, Math.min(1, (h - p.y) / 120));
          const op = p.targetOp * ageFade * bottomFade;
          p.el.style.opacity = op.toFixed(3);
          p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;

          if (p.y > h + 20 || x < -40 || x > w + 40) destroy(p);
        } else if (p.kind === "flake") {
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
          const rot = (p.rot ?? 0) + (p.vrot ?? 0) * p.age;
          const life = p.life ?? 12;

          let op = p.targetOp;
          if (p.age < 1) op = p.targetOp * p.age;
          else if (p.age > life - 1.5)
            op = p.targetOp * Math.max(0, (life - p.age) / 1.5);

          p.el.style.opacity = op.toFixed(3);
          p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg)`;

          if (
            p.age >= life ||
            x < -(p.size ?? 20) * 2 ||
            x > w + (p.size ?? 20) ||
            y < -(p.size ?? 20) * 2 ||
            y > h + (p.size ?? 20)
          ) {
            destroy(p);
          }
        }
      }

      // dead を取り除き、不足分の flake を補充
      poolRef.current = pool.filter((p) => !p.dead);
      const flakeCount = poolRef.current.filter(
        (p) => p.kind === "flake",
      ).length;
      if (flakeCount < MAX_FLAKES) {
        const p = spawnFlake();
        if (p) poolRef.current.push(p);
      }

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
      for (const p of poolRef.current) destroy(p);
      poolRef.current = [];
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[1] pointer-events-none overflow-hidden"
      aria-hidden="true"
    />
  );
};

/**
 * 冬景色の背景。1 枚絵 (bg-winter.png) を cover 配置し、上に雪 + ドット
 * のパーティクルを RAF で被せる。プロトタイプ準拠で山・白樺・川・鉄道の
 * SVG は廃止。
 */
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
