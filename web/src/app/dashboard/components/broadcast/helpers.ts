import { API_BASE } from "~/lib/api/client";
import type { BroadcastMessage, BroadcastPart } from "~/types";

export type PartState = { id: string } & (
  | Extract<BroadcastPart, { type: "text" }>
  | (Extract<BroadcastPart, { type: "image" }> & {
      file?: File;
      previewUrl?: string;
    })
);

/**
 * 既存 broadcast を編集 form の初期 state に変換する。
 * parts が無いかパース失敗時は body をテキストパート 1 件として復元する。
 */
export const parseParts = (
  broadcast: BroadcastMessage,
  generateId: () => string,
): PartState[] => {
  if (broadcast.parts) {
    try {
      const raw = JSON.parse(broadcast.parts) as Omit<PartState, "id">[];
      return raw.map((p) => ({ ...p, id: generateId() }) as PartState);
    } catch {
      // body fallback
    }
  }
  return [{ id: generateId(), type: "text", text: broadcast.body }];
};

export const getImageUrl = (imageR2Key: string) =>
  `${API_BASE}/broadcast/media/${imageR2Key}`;
