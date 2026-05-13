import { useCallback, useRef, useState } from "react";

import {
  useCreateBroadcast,
  useSendBroadcast,
  useUpdateBroadcast,
  useUploadBroadcastImage,
} from "~/app/dashboard/hooks/useBroadcasts";
import { confirmDialog } from "~/lib/dialog";
import type { BroadcastMessage, BroadcastPart } from "~/types";
import { type PartState, parseParts } from "./helpers";

export const MAX_PARTS = 5;

export type ModalMode = "create" | "edit";
export type SendTiming = "now" | "schedule";

type Options = {
  mode: ModalMode;
  broadcast?: BroadcastMessage;
  onClose: () => void;
};

const isPartFilled = (p: PartState) => {
  if (p.type === "text") return p.text.trim().length > 0;
  if (p.type === "image") return !!(p.imageR2Key || p.file);
  return false;
};

export const useBroadcastForm = ({ mode, broadcast, onClose }: Options) => {
  const partIdCounterRef = useRef(0);
  const nextPartId = useCallback(
    () => `part-${++partIdCounterRef.current}`,
    [],
  );

  const [parts, setParts] = useState<PartState[]>(() =>
    broadcast
      ? parseParts(broadcast, nextPartId)
      : [{ id: nextPartId(), type: "text", text: "" }],
  );
  const [timing, setTiming] = useState<SendTiming>(
    broadcast?.scheduledAt ? "schedule" : "now",
  );
  const [scheduledAt, setScheduledAt] = useState(
    broadcast?.scheduledAt?.slice(0, 16) ?? "",
  );

  const createMutation = useCreateBroadcast();
  const updateMutation = useUpdateBroadcast();
  const sendMutation = useSendBroadcast();
  const uploadMutation = useUploadBroadcastImage();

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    sendMutation.isPending ||
    uploadMutation.isPending;

  const isValid =
    parts.length > 0 &&
    parts.every(isPartFilled) &&
    (timing === "now" || (timing === "schedule" && scheduledAt.length > 0));

  const isError =
    createMutation.isError ||
    updateMutation.isError ||
    sendMutation.isError ||
    uploadMutation.isError;

  const errorMessage =
    createMutation.error?.message ||
    updateMutation.error?.message ||
    sendMutation.error?.message ||
    uploadMutation.error?.message ||
    null;

  const handlePartChange = useCallback((index: number, part: PartState) => {
    setParts((prev) => prev.map((p, i) => (i === index ? part : p)));
  }, []);

  const handlePartRemove = useCallback((index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePartMove = useCallback(
    (index: number, direction: "up" | "down") => {
      setParts((prev) => {
        const next = [...prev];
        const target = direction === "up" ? index - 1 : index + 1;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    },
    [],
  );

  const handleAddPart = useCallback(() => {
    setParts((prev) => {
      if (prev.length >= MAX_PARTS) return prev;
      return [...prev, { id: nextPartId(), type: "text", text: "" }];
    });
  }, [nextPartId]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;

    if (timing === "now") {
      if (
        !confirmDialog(
          "この配信メッセージをLINE全フォロワーに即時送信しますか？",
        )
      ) {
        return;
      }
    }

    const uploadedParts: BroadcastPart[] = await Promise.all(
      parts.map(async (part) => {
        if (part.type === "text") {
          return { type: "text" as const, text: part.text };
        }
        if (part.file) {
          const { imageR2Key, imageDescription } =
            await uploadMutation.mutateAsync(part.file);
          return { type: "image" as const, imageR2Key, imageDescription };
        }
        return {
          type: "image" as const,
          imageR2Key: part.imageR2Key,
          imageDescription: part.imageDescription,
        };
      }),
    );

    if (timing === "now") {
      if (mode === "create") {
        await createMutation.mutateAsync({
          parts: uploadedParts,
          sendNow: true,
        });
      } else if (broadcast) {
        await updateMutation.mutateAsync({
          id: broadcast.id,
          data: { parts: uploadedParts },
        });
        await sendMutation.mutateAsync(broadcast.id);
      }
    } else {
      const isoDate = new Date(scheduledAt).toISOString();
      if (mode === "create") {
        await createMutation.mutateAsync({
          parts: uploadedParts,
          scheduledAt: isoDate,
        });
      } else if (broadcast) {
        await updateMutation.mutateAsync({
          id: broadcast.id,
          data: { parts: uploadedParts, scheduledAt: isoDate },
        });
      }
    }
    onClose();
  }, [
    isValid,
    timing,
    parts,
    mode,
    broadcast,
    scheduledAt,
    createMutation,
    updateMutation,
    sendMutation,
    uploadMutation,
    onClose,
  ]);

  return {
    parts,
    timing,
    setTiming,
    scheduledAt,
    setScheduledAt,
    isPending,
    isValid,
    isError,
    errorMessage,
    handlePartChange,
    handlePartRemove,
    handlePartMove,
    handleAddPart,
    handleSubmit,
  };
};
