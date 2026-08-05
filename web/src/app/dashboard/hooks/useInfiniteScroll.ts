import { useEffect, useState } from "react";

type Options = {
  hasNextPage: boolean;
  isFetching: boolean;
  onFetch: () => void;
  threshold?: number;
};

// センチネルは条件付きで描画されるため、element を state で持って再マウントを検知する
// （ref オブジェクトだと再マウント時に effect が動かず、外れた DOM を監視し続ける）
export const useInfiniteScroll = <T extends HTMLElement = HTMLDivElement>({
  hasNextPage,
  isFetching,
  onFetch,
  threshold = 0.1,
}: Options) => {
  const [element, setElement] = useState<T | null>(null);

  useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetching) {
          onFetch();
        }
      },
      { threshold },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [element, hasNextPage, isFetching, onFetch, threshold]);

  return setElement;
};
