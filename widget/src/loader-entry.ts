import { mountWidget, resolveIconSrc, resolveIframeSrc } from "./loader";

const currentScript = document.currentScript as HTMLScriptElement | null;
if (currentScript?.src) {
  mountWidget({
    iframeSrc: resolveIframeSrc(currentScript.src),
    iconSrc: resolveIconSrc(currentScript.src),
  });
}
