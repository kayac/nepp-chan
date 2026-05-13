import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInfiniteScroll } from "./useInfiniteScroll";

const observe = vi.fn();
const disconnect = vi.fn();
let lastCallback: ((entries: IntersectionObserverEntry[]) => void) | undefined;
let lastOptions: IntersectionObserverInit | undefined;

class MockIntersectionObserver {
  constructor(
    callback: (entries: IntersectionObserverEntry[]) => void,
    options?: IntersectionObserverInit,
  ) {
    lastCallback = callback;
    lastOptions = options;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn();
  root = null;
  rootMargin = "";
  thresholds = [];
}

beforeEach(() => {
  observe.mockReset();
  disconnect.mockReset();
  lastCallback = undefined;
  lastOptions = undefined;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Props = {
  hasNextPage: boolean;
  isFetching: boolean;
  onFetch: () => void;
  threshold?: number;
};

const Host = (props: Props) => {
  const ref = useInfiniteScroll<HTMLDivElement>(props);
  // 子要素は不要、ref を attach するだけ
  return createElement("div", { ref });
};

// IntersectionObserver の callback を発火するヘルパ
const fire = (isIntersecting: boolean) => {
  if (!lastCallback) throw new Error("observer not created");
  act(() => {
    lastCallback?.([{ isIntersecting } as IntersectionObserverEntry]);
  });
};

describe("useInfiniteScroll", () => {
  it("element が ref に紐付くと observe される", () => {
    render(
      createElement(Host, {
        hasNextPage: true,
        isFetching: false,
        onFetch: vi.fn(),
      }),
    );
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it("threshold を IntersectionObserver に渡す", () => {
    render(
      createElement(Host, {
        hasNextPage: true,
        isFetching: false,
        onFetch: vi.fn(),
        threshold: 0.5,
      }),
    );
    expect(lastOptions?.threshold).toBe(0.5);
  });

  it("isIntersecting + hasNextPage + !isFetching で onFetch", () => {
    const onFetch = vi.fn();
    render(
      createElement(Host, {
        hasNextPage: true,
        isFetching: false,
        onFetch,
      }),
    );

    fire(true);
    expect(onFetch).toHaveBeenCalledTimes(1);
  });

  it("isIntersecting=false なら onFetch は呼ばない", () => {
    const onFetch = vi.fn();
    render(
      createElement(Host, {
        hasNextPage: true,
        isFetching: false,
        onFetch,
      }),
    );
    fire(false);
    expect(onFetch).not.toHaveBeenCalled();
  });

  it("hasNextPage=false なら onFetch は呼ばない", () => {
    const onFetch = vi.fn();
    render(
      createElement(Host, {
        hasNextPage: false,
        isFetching: false,
        onFetch,
      }),
    );
    fire(true);
    expect(onFetch).not.toHaveBeenCalled();
  });

  it("isFetching=true なら onFetch は呼ばない", () => {
    const onFetch = vi.fn();
    render(
      createElement(Host, {
        hasNextPage: true,
        isFetching: true,
        onFetch,
      }),
    );
    fire(true);
    expect(onFetch).not.toHaveBeenCalled();
  });

  it("アンマウント時に disconnect される", () => {
    const { unmount } = render(
      createElement(Host, {
        hasNextPage: true,
        isFetching: false,
        onFetch: vi.fn(),
      }),
    );
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("element が無ければ observe しない (条件付き render)", () => {
    const Conditional = (props: { mount: boolean }) => {
      // hook は常に呼ぶが、ref を attach する div は条件付き
      const ref = useInfiniteScroll<HTMLDivElement>({
        hasNextPage: true,
        isFetching: false,
        onFetch: vi.fn(),
      });
      // mount=false の時は何もレンダリングしない
      return props.mount ? createElement("div", { ref }) : null;
    };

    // ref の初期 effect で ref.current が null
    render(createElement(Conditional, { mount: false }));
    expect(observe).not.toHaveBeenCalled();
  });
});
