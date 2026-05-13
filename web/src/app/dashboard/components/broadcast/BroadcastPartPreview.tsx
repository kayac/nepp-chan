import type { BroadcastPart } from "~/types";
import { getImageUrl } from "./helpers";

type Props = {
  parts: string | null;
};

export const BroadcastPartPreview = ({ parts }: Props) => {
  if (!parts) return null;

  let parsed: BroadcastPart[];
  try {
    parsed = JSON.parse(parts);
  } catch {
    return null;
  }

  const images = parsed.filter(
    (p): p is Extract<BroadcastPart, { type: "image" }> => p.type === "image",
  );
  if (images.length === 0) return null;

  return (
    <div className="flex gap-1.5 mb-1.5">
      {images.map((p) => (
        <img
          key={p.imageR2Key}
          src={getImageUrl(p.imageR2Key)}
          alt=""
          className="w-12 h-12 rounded object-cover border border-stone-200"
        />
      ))}
    </div>
  );
};
