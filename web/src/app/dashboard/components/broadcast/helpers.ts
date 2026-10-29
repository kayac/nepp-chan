import { API_BASE } from "~/lib/api/client";
import type { BroadcastMessage, BroadcastPart } from "~/types";

export type PartState = { id: string } & (
  | Extract<BroadcastPart, { type: "text" }>
  | (Extract<BroadcastPart, { type: "image" }> & {
      file?: File;
      previewUrl?: string;
    })
);

export const parseParts = (
  broadcast: BroadcastMessage,
  generateId: () => string,
): PartState[] => {
  if (broadcast.parts) {
    try {
      const raw = JSON.parse(broadcast.parts) as Omit<PartState, "id">[];
      return raw.map((p) => ({ ...p, id: generateId() }) as PartState);
    } catch {}
  }
  return [{ id: generateId(), type: "text", text: broadcast.body }];
};

export const getImageUrl = (imageR2Key: string) =>
  `${API_BASE}/broadcast/media/${imageR2Key}`;
