import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const BOTTOM_THRESHOLD_PX = 40;

export const useStickToBottom = (dependency: unknown) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);

  const setAtBottom = useCallback((value: boolean) => {
    isAtBottomRef.current = value;
    setIsAtBottom(value);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    setAtBottom(true);
    const start = el.scrollTop;
    const distance = el.scrollHeight - el.clientHeight - start;
    if (distance <= 0) return;
    const durationMs = 250;
    let startTs = 0;
    const step = (ts: number) => {
      if (startTs === 0) startTs = ts;
      const progress = Math.min(1, (ts - startTs) / durationMs);
      el.scrollTop = start + distance * (1 - (1 - progress) ** 3);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [setAtBottom]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(distance <= BOTTOM_THRESHOLD_PX);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [setAtBottom]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: dependency の変化自体を追従トリガーにする
  useLayoutEffect(() => {
    if (!isAtBottomRef.current) return;
    const el = viewportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dependency]);

  // 画像読み込みなどメッセージ更新を伴わない高さ変化にも追従する
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { viewportRef, isAtBottom, scrollToBottom };
};
