import { useState } from "react";

const COPIED_DURATION = 500;

export const useCopyToClipboard = () => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPIED_DURATION);
    });
  };

  return { isCopied, copyToClipboard };
};
