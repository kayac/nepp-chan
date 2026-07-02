const WIDGET_FLAG = "__neppChatWidgetLoaded";
const Z_INDEX = "2147483000";

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
    "width: 70%; height: 70%; object-fit: contain; pointer-events: none;";
  button.appendChild(icon);

  let iframe: HTMLIFrameElement | null = null;
  let open = false;

  const toggle = () => {
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
        display: none;
      `;
      doc.body.appendChild(iframe);
    }
    open = !open;
    iframe.style.display = open ? "block" : "none";
    button.setAttribute("aria-expanded", String(open));
  };

  button.addEventListener("click", toggle);
  doc.body.appendChild(button);
};
