import { type Role, useConversation } from "@elevenlabs/react";
import { useRef, useState } from "react";
import { fetchSignedUrl } from "./api";

export type TranscriptLine = { id: number; role: Role; text: string };

export const useElevenConversation = () => {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(0);
  const { startSession, endSession, status, mode } = useConversation({
    onMessage: ({ role, message }) =>
      setLines((prev) => [
        ...prev,
        { id: nextId.current++, role, text: message },
      ]),
    onError: (message) => setError(message),
  });

  const start = async () => {
    setError(null);
    setLines([]);
    try {
      const signedUrl = await fetchSignedUrl();
      startSession({ signedUrl, connectionType: "websocket" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "会話を開始できませんでした");
    }
  };

  return { status, mode, error, lines, start, stop: endSession };
};
