import { useEffect, useRef } from "react";

type Options = {
  hasNextPage: boolean;
  isFetching: boolean;
  onFetch: () => void;
  threshold?: number;
};

export const useInfiniteScroll = <T extends HTMLElement = HTMLDivElement>({
  hasNextPage,
  isFetching,
  onFetch,
  threshold = 0.1,
}: Options) => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
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
  }, [hasNextPage, isFetching, onFetch, threshold]);

  return ref;
};
