import {
  mountWidget,
  onDocumentReady,
  resolveIconSrc,
  resolveIframeSrc,
} from "./loader";

const currentScript = document.currentScript as HTMLScriptElement | null;
const scriptSrc = currentScript?.src;
if (scriptSrc) {
  onDocumentReady(document, () => {
    mountWidget({
      iframeSrc: resolveIframeSrc(scriptSrc),
      iconSrc: resolveIconSrc(scriptSrc),
    });
  });
}
