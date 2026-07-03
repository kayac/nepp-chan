import { CLOSE_MESSAGE_TYPE } from "./messages";

const WIDGET_FLAG = "__neppChatWidgetLoaded";
const Z_INDEX = "2147483000";
const PANEL_TRANSITION_MS = 200;

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

  button.addEventListener("click", toggle);
  doc.body.appendChild(button);

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
