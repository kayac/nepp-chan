import { useEffect, useState } from "react";

const readStyle = () => {
  const viewport = window.visualViewport;
  if (viewport?.scale !== 1) return undefined;
  return { height: viewport.height, top: viewport.offsetTop };
};

export const useVisualViewportStyle = () => {
  const [style, setStyle] = useState(readStyle);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => setStyle(readStyle());
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return style;
};
