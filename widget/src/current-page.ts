import {
  CURRENT_PAGE_REQUEST_MESSAGE_TYPE,
  CURRENT_PAGE_RESPONSE_MESSAGE_TYPE,
} from "./messages";

const RESPONSE_TIMEOUT_MS = 250;

export const requestCurrentPageUrl = (fallbackUrl?: string) => {
  const parent = window.parent;
  if (parent === window) return Promise.resolve(fallbackUrl);

  return new Promise<string | undefined>((resolve) => {
    const finish = (currentPageUrl?: string) => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      resolve(currentPageUrl ?? fallbackUrl);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== parent) return;
      const data = event.data as {
        type?: unknown;
        currentPageUrl?: unknown;
      } | null;
      if (data?.type !== CURRENT_PAGE_RESPONSE_MESSAGE_TYPE) return;
      finish(
        typeof data.currentPageUrl === "string"
          ? data.currentPageUrl
          : undefined,
      );
    };
    const timeoutId = window.setTimeout(() => finish(), RESPONSE_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    parent.postMessage({ type: CURRENT_PAGE_REQUEST_MESSAGE_TYPE }, "*");
  });
};
