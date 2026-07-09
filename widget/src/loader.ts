import { INITIAL_MESSAGE } from "@nepp-chan/shared/constants/simple-chat";
import { messageText } from "@nepp-chan/shared/lib/message-text";
import { CLOSE_MESSAGE_TYPE } from "./messages";

const WIDGET_FLAG = "__neppChatWidgetLoaded";
const Z_INDEX = "2147483000";
const PANEL_TRANSITION_MS = 200;
const TEASER_DELAY_MS = 2500;
const TEASER_REVIVE_MS = 7 * 24 * 60 * 60 * 1000;
const TEASER_DISMISSED_KEY = "nepp-chan-widget:teaser-dismissed-at";
const TEASER_TEXT = messageText(INITIAL_MESSAGE);

export const resolveIframeSrc = (scriptSrc: string) =>
  new URL("./", scriptSrc).href;

export const resolveIconSrc = (scriptSrc: string) =>
  new URL("../mascot/icon.png", scriptSrc).href;

export const onDocumentReady = (doc: Document, callback: () => void) => {
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }
  callback();
};

type MountOptions = {
  iframeSrc: string;
  iconSrc: string;
  doc?: Document;
};

const applyPanelState = (iframe: HTMLIFrameElement, open: boolean) => {
  iframe.style.visibility = open ? "visible" : "hidden";
  iframe.style.opacity = open ? "1" : "0";
  iframe.style.transform = open ? "translateY(0)" : "translateY(8px)";
  iframe.style.pointerEvents = open ? "auto" : "none";
};

export const mountWidget = ({
  iframeSrc,
  iconSrc,
  doc = document,
}: MountOptions) => {
  const win = doc.defaultView as (Window & Record<string, unknown>) | null;
  if (!win || win[WIDGET_FLAG]) return;
  win[WIDGET_FLAG] = true;

  const button = doc.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "ねっぷちゃんとチャット");
  button.setAttribute("aria-expanded", "false");
  button.style.cssText = `
    all: initial;
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 60px;
    height: 60px;
    border-radius: 9999px;
    background: #5cb7bb;
    box-shadow: 0 6px 20px rgba(15, 118, 110, 0.35);
    cursor: pointer;
    z-index: ${Z_INDEX};
    overflow: hidden;
    display: grid;
    place-items: center;
  `;

  const icon = doc.createElement("img");
  icon.src = iconSrc;
  icon.alt = "";
  icon.style.cssText =
    "width: 100%; height: 100%; object-fit: cover; pointer-events: none;";
  button.appendChild(icon);

  let iframe: HTMLIFrameElement | null = null;
  let open = false;
  let pendingOpenFrame: number | null = null;
  let teaser: HTMLDivElement | null = null;
  let teaserTimer: number | null = null;
  let teaserOpenFrame: number | null = null;

  const readTeaserDismissedAt = () => {
    try {
      return win.localStorage.getItem(TEASER_DISMISSED_KEY);
    } catch {
      return null;
    }
  };

  const shouldShowTeaser = () => {
    const raw = readTeaserDismissedAt();
    if (raw === null) return true;
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return true;
    return Date.now() - dismissedAt > TEASER_REVIVE_MS;
  };

  const recordTeaserDismissed = () => {
    try {
      win.localStorage.setItem(TEASER_DISMISSED_KEY, String(Date.now()));
    } catch {
      // プライベートモード等 localStorage が使えない環境では記録を諦める
    }
  };

  const suppressTeaser = () => {
    if (teaserTimer !== null) {
      win.clearTimeout(teaserTimer);
      teaserTimer = null;
    }
    if (teaser) {
      if (teaserOpenFrame !== null) {
        win.cancelAnimationFrame(teaserOpenFrame);
        teaserOpenFrame = null;
      }
      teaser.remove();
      teaser = null;
    }
    recordTeaserDismissed();
  };

  const setOpen = (next: boolean) => {
    if (!iframe) return;
    open = next;
    applyPanelState(iframe, open);
    button.setAttribute("aria-expanded", String(open));
  };

  const toggle = () => {
    if (pendingOpenFrame !== null) {
      win.cancelAnimationFrame(pendingOpenFrame);
      pendingOpenFrame = null;
    }

    if (!open) suppressTeaser();

    if (!iframe) {
      iframe = doc.createElement("iframe");
      iframe.src = iframeSrc;
      iframe.title = "ねっぷちゃん";
      iframe.style.cssText = `
        position: fixed;
        right: 20px;
        bottom: 92px;
        width: min(384px, calc(100vw - 32px));
        height: min(600px, calc(100dvh - 132px));
        border: none;
        border-radius: 20px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.18);
        background: transparent;
        z-index: ${Z_INDEX};
        transition: opacity ${PANEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${PANEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), visibility ${PANEL_TRANSITION_MS}ms;
      `;
      applyPanelState(iframe, false);
      doc.body.appendChild(iframe);
      // 強制 reflow で closed スタイルを確定させ、初回 open のトランジションを効かせる
      iframe.getBoundingClientRect();
      open = true;
      button.setAttribute("aria-expanded", "true");
      pendingOpenFrame = win.requestAnimationFrame(() => {
        pendingOpenFrame = null;
        if (iframe) applyPanelState(iframe, true);
      });
      return;
    }
    setOpen(!open);
  };

  const showTeaser = () => {
    teaserTimer = null;

    const el = doc.createElement("div");
    el.style.cssText = `
      all: initial;
      position: fixed;
      right: 20px;
      bottom: 92px;
      max-width: min(260px, calc(100vw - 100px));
      background: #fff;
      border-radius: 16px 16px 4px 16px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.18);
      z-index: ${Z_INDEX};
      opacity: 0;
      transform: translateY(8px);
      transition: opacity ${PANEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${PANEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
    `;

    const openButton = doc.createElement("button");
    openButton.type = "button";
    openButton.setAttribute("aria-label", "ねっぷちゃんに質問する");
    openButton.textContent = TEASER_TEXT;
    openButton.style.cssText = `
      all: initial;
      display: block;
      padding: 12px 26px 12px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #333;
      text-align: left;
      white-space: pre-line;
      cursor: pointer;
    `;
    openButton.addEventListener("click", () => {
      if (!open) toggle();
    });
    el.appendChild(openButton);

    const closeButton = doc.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "案内を閉じる");
    closeButton.textContent = "×";
    closeButton.style.cssText = `
      all: initial;
      position: absolute;
      top: 2px;
      right: 6px;
      width: 20px;
      height: 20px;
      line-height: 20px;
      text-align: center;
      font-size: 14px;
      color: #999;
      cursor: pointer;
    `;
    closeButton.addEventListener("click", () => {
      suppressTeaser();
    });
    el.appendChild(closeButton);

    doc.body.appendChild(el);
    el.getBoundingClientRect();
    teaser = el;
    teaserOpenFrame = win.requestAnimationFrame(() => {
      teaserOpenFrame = null;
      if (teaser) {
        teaser.style.opacity = "1";
        teaser.style.transform = "translateY(0)";
      }
    });
  };

  button.addEventListener("click", toggle);
  doc.body.appendChild(button);

  if (shouldShowTeaser()) {
    teaserTimer = win.setTimeout(showTeaser, TEASER_DELAY_MS);
  }

  const iframeOrigin = new URL(iframeSrc).origin;
  win.addEventListener("message", (event) => {
    if (!iframe) return;
    if (event.origin !== iframeOrigin) return;
    if (event.source !== iframe.contentWindow) return;
    if (
      (event.data as { type?: unknown } | null)?.type !== CLOSE_MESSAGE_TYPE
    ) {
      return;
    }
    setOpen(false);
  });
};
