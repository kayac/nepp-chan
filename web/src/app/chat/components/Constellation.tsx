import { useEffect, useRef } from "react";

type Props = {
  active?: boolean;
  densityPerMegapx?: number;
};

type Particle = {
  el: SVGCircleElement;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wigAmp: number;
  wigFreq: number;
  phase: number;
  born: number;
  dead: boolean;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const EDGE_MAX_DIST = 140;
const EDGE_PER_NODE = 2;
// エッジ計算は重いので毎フレームではなく EDGE_REBUILD_INTERVAL_MS に 1 回
const EDGE_REBUILD_INTERVAL_MS = 100;

export const Constellation = ({
  active = false,
  densityPerMegapx = 120,
}: Props) => {
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    const svg = svgRef.current;
    if (!host || !svg) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let w = host.clientWidth;
    let h = host.clientHeight;
    const setSize = () => {
      w = host.clientWidth;
      h = host.clientHeight;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    };
    setSize();

    const particles: Particle[] = [];
    const edgeEls: SVGLineElement[] = [];
    // 各 tick で算出した粒子の表示座標。エッジ計算でも参照する
    const positions: { x: number; y: number }[] = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const makeDot = (spawnFromTop: boolean): Particle => {
      const el = document.createElementNS(SVG_NS, "circle");
      // 雪景色背景でも視認できるよう一回り大きく
      const r = rand(2.0, 3.6);
      el.setAttribute("r", r.toFixed(2));
      el.setAttribute("fill", "var(--constellation-dot)");
      svg.appendChild(el);
      return {
        el,
        r,
        x: rand(0, w),
        y: spawnFromTop ? rand(-40, -4) : rand(0, h),
        vx: rand(-4, 4),
        vy: rand(6, 14),
        wigAmp: rand(3, 10),
        wigFreq: rand(0.1, 0.35),
        phase: rand(0, Math.PI * 2),
        born: performance.now(),
        dead: false,
      };
    };

    const makeEdge = (): SVGLineElement => {
      const el = document.createElementNS(SVG_NS, "line");
      el.setAttribute("stroke", "var(--constellation-line)");
      el.setAttribute("stroke-width", "1.2");
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("opacity", "0");
      svg.appendChild(el);
      return el;
    };

    const targetCount = () => {
      const area = Math.max(1, (w * h) / 1_000_000);
      // モバイル幅では密度を抑えて負荷軽減
      const isMobile = w < 768;
      const density = isMobile ? densityPerMegapx * 0.5 : densityPerMegapx;
      return Math.min(120, Math.max(20, Math.round(density * area)));
    };

    let target = targetCount();
    for (let i = 0; i < target; i++) particles.push(makeDot(false));
    for (let i = 0; i < target * EDGE_PER_NODE; i++) edgeEls.push(makeEdge());

    const ro = new ResizeObserver(() => {
      setSize();
      target = targetCount();
      while (particles.length < target) particles.push(makeDot(true));
      while (edgeEls.length < target * EDGE_PER_NODE) edgeEls.push(makeEdge());
    });
    ro.observe(host);

    const destroy = (p: Particle) => {
      if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
      p.dead = true;
    };

    let last = performance.now();
    let lastEdgeRebuildAt = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const paused = activeRef.current || reduceMotion;

      positions.length = particles.length;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.dead) continue;

        let x = p.x;
        let y = p.y;
        if (!paused) {
          p.y += p.vy * dt;
          const wig =
            Math.sin((now / 1000) * p.wigFreq * Math.PI * 2 + p.phase) *
            p.wigAmp;
          x = p.x + p.vx * ((now - p.born) / 1000) + wig;
          y = p.y;
          if (y > h + 20 || x < -40 || x > w + 40) {
            destroy(p);
            particles[i] = makeDot(true);
            continue;
          }
        }

        const pulse = paused
          ? 0.8 + 0.2 * Math.sin((now / 1000) * 2.6 + (i % 6) * 0.3)
          : 0.9 + 0.1 * Math.sin((now / 1000) * 0.8 + (i % 5) * 0.5);

        p.el.setAttribute("cx", x.toFixed(2));
        p.el.setAttribute("cy", y.toFixed(2));
        p.el.setAttribute("opacity", pulse.toFixed(3));
        positions[i] = { x, y };
      }

      // エッジ再計算は EDGE_REBUILD_INTERVAL_MS 毎（O(N²) なので間引き）
      if (now - lastEdgeRebuildAt > EDGE_REBUILD_INTERVAL_MS) {
        lastEdgeRebuildAt = now;
        let ek = 0;
        for (let i = 0; i < particles.length && ek < edgeEls.length; i++) {
          const pi = positions[i];
          if (!pi) continue;
          let bestD = Number.POSITIVE_INFINITY;
          let bestJ = -1;
          let secondD = Number.POSITIVE_INFINITY;
          let secondJ = -1;
          for (let j = 0; j < particles.length; j++) {
            if (j === i) continue;
            const pj = positions[j];
            if (!pj) continue;
            const d = Math.hypot(pi.x - pj.x, pi.y - pj.y);
            if (d < bestD) {
              secondD = bestD;
              secondJ = bestJ;
              bestD = d;
              bestJ = j;
            } else if (d < secondD) {
              secondD = d;
              secondJ = j;
            }
          }
          for (let kk = 0; kk < EDGE_PER_NODE && ek < edgeEls.length; kk++) {
            const jj = kk === 0 ? bestJ : secondJ;
            const dd = kk === 0 ? bestD : secondD;
            if (jj < 0 || jj <= i || dd > EDGE_MAX_DIST) continue;
            const el = edgeEls[ek++];
            const pj = positions[jj];
            el.setAttribute("x1", pi.x.toFixed(2));
            el.setAttribute("y1", pi.y.toFixed(2));
            el.setAttribute("x2", pj.x.toFixed(2));
            el.setAttribute("y2", pj.y.toFixed(2));
            const op = paused
              ? 0.6
              : Math.max(
                  0,
                  Math.min(0.45, ((EDGE_MAX_DIST - dd) / EDGE_MAX_DIST) * 0.5),
                );
            el.setAttribute("opacity", op.toFixed(3));
          }
        }
        for (let k = ek; k < edgeEls.length; k++) {
          edgeEls[k].setAttribute("opacity", "0");
        }
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
      for (const p of particles) destroy(p);
      for (const el of edgeEls) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }, [densityPerMegapx]);

  return (
    <div
      ref={hostRef}
      className="fixed inset-0 z-[1] pointer-events-none"
      aria-hidden="true"
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <title>constellation background</title>
      </svg>
    </div>
  );
};
