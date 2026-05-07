import { type RefObject, useEffect, useRef, useState } from "react";

type Options = {
  rootMargin?: string;
  threshold?: number | number[];
  once?: boolean;
};

/**
 * 要素が viewport に入ったら data-revealed 属性 / state を true にする hook。
 * Tailwind の data-[revealed=true]: variant で transition を表現する想定。
 */
export const useScrollReveal = <T extends Element = HTMLDivElement>(
  options: Options = {},
): { ref: RefObject<T | null>; revealed: boolean } => {
  const {
    rootMargin = "0px 0px -80px 0px",
    threshold = 0.08,
    once = true,
  } = options;
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setRevealed(false);
          }
        }
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, revealed };
};
