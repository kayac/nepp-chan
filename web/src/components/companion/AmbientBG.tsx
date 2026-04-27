import { useEffect, useMemo, useRef } from "react";
import { Birch } from "./decorations";

type BirchSeed = {
  height: number;
  jitter: number;
  seed: number;
};

const seededRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const buildBirchStrip = (
  rand: () => number,
  count: number,
  hMin: number,
  hMax: number,
  seedOffset = 0,
): BirchSeed[] => {
  const arr: BirchSeed[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      height: hMin + rand() * (hMax - hMin),
      jitter: (rand() - 0.5) * 10,
      seed: seedOffset + i * 7 + Math.floor(rand() * 100),
    });
  }
  return [...arr, ...arr];
};

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

export const AmbientBG = () => {
  const scene = useMemo(() => {
    const r = seededRng(11);
    const birchesBack = buildBirchStrip(r, 14, 110, 160, 1);
    const birchesFore = buildBirchStrip(r, 12, 150, 230, 100);
    return { birchesBack, birchesFore };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* paper-50 ground extender (lower 14%) */}
      <div className="absolute left-0 right-0 bottom-0 h-[14%] bg-(--paper-50) z-[2] pointer-events-none" />

      {/* Distant mountains */}
      <svg
        className="absolute top-[8%] -left-[4%] w-[108%] h-[32%] opacity-55"
        style={{ filter: "saturate(0.35)" }}
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <title>distant mountains</title>
        <defs>
          <linearGradient id="mtnBackGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c9d6dc" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#b6c6cd" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="mtnFrontGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b8c9c2" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#9fb3a9" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <path
          d="M0 200 L90 130 L180 170 L260 90 L340 150 L430 70 L520 140 L610 100 L700 160 L790 110 L880 150 L970 80 L1060 140 L1150 100 L1240 160 L1340 120 L1440 170 L1440 300 L0 300 Z"
          fill="url(#mtnBackGrad)"
        />
        <g fill="var(--paper-0)" opacity="0.55">
          <path d="M260 90 L275 108 L262 104 L250 112 L245 108 Z" />
          <path d="M430 70 L448 96 L430 90 L418 100 L412 94 Z" />
          <path d="M970 80 L988 104 L970 100 L960 108 L952 102 Z" />
        </g>
        <path
          d="M0 230 L80 190 L170 220 L250 170 L340 210 L420 175 L500 215 L590 180 L680 220 L770 185 L860 215 L940 180 L1020 220 L1110 185 L1200 215 L1290 190 L1380 220 L1440 200 L1440 300 L0 300 Z"
          fill="url(#mtnFrontGrad)"
        />
      </svg>

      {/* Back birches */}
      <div
        className="absolute -left-[10%] w-[220%] bottom-[40%] flex items-end gap-[64px] opacity-55"
        style={{ filter: "blur(0.6px) saturate(0.3)" }}
      >
        {scene.birchesBack.map((b, i) => (
          <Birch
            // biome-ignore lint/suspicious/noArrayIndexKey: deterministic seed list
            key={i}
            height={b.height}
            seed={b.seed}
            leafColor="#c8d4c2"
            style={{
              transform: `translateY(${b.jitter}px)`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>

      {/* Railroad */}
      <div
        className="absolute left-0 right-0 bottom-[14%] h-[14px] opacity-30"
        style={{ filter: "saturate(0.2)" }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #6b5b4a 0, #6b5b4a 6px, transparent 6px, transparent 22px)",
          }}
        />
        <div className="absolute left-0 right-0 top-0.5 h-px bg-[#8a8a8a]" />
        <div className="absolute left-0 right-0 bottom-0.5 h-px bg-[#8a8a8a]" />
      </div>

      {/* River */}
      <div
        className="absolute -left-[5%] -right-[5%] bottom-[52%] h-[26px] opacity-55 rounded-[2px] overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #e8f1f4 0%, #d4e4ea 50%, #bed1d9 100%)",
          transform: "skewY(-0.8deg)",
          filter: "saturate(0.35)",
        }}
        aria-hidden="true"
      >
        <svg
          className="absolute left-0 top-0 w-full h-full"
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
        >
          <title>river waves</title>
          <defs>
            <pattern
              id="riverWaves"
              x="0"
              y="0"
              width="120"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0 10 Q 30 2, 60 10 T 120 10"
                fill="none"
                stroke="var(--paper-0)"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.7"
              />
            </pattern>
          </defs>
          <rect x="0" y="0" width="1200" height="40" fill="url(#riverWaves)" />
        </svg>
      </div>

      {/* Fore birches */}
      <div
        className="absolute -left-[10%] w-[220%] bottom-[2%] flex items-end gap-[110px] opacity-70"
        style={{ filter: "saturate(0.45)" }}
      >
        {scene.birchesFore.map((b, i) => (
          <Birch
            // biome-ignore lint/suspicious/noArrayIndexKey: deterministic seed list
            key={i}
            height={b.height}
            seed={b.seed}
            leafColor="#b5c5ad"
            style={{
              transform: `translateY(${b.jitter}px)`,
              opacity: 0.8,
            }}
          />
        ))}
      </div>

      {/* Particles */}
      <ParticleField />
    </div>
  );
};
