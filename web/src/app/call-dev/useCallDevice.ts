import { type Call, Device } from "@twilio/voice-sdk";
import { useCallback, useRef, useState } from "react";
import { fetchCallToken } from "./api";

export type CallStatus = "idle" | "connecting" | "connected" | "error";

export const useCallDevice = () => {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);

  const destroyDevice = useCallback(() => {
    deviceRef.current?.destroy();
    deviceRef.current = null;
  }, []);

  const startCall = useCallback(
    async (voicePreset?: string) => {
      setError(null);
      setStatus("connecting");
      destroyDevice();
      try {
        const { token } = await fetchCallToken();
        const device = new Device(token, { logLevel: "error" });
        // トークン期限切れ等は Call ではなく Device が 'error' を emit する。
        device.on("error", (e: { message?: string }) => {
          setError(e.message ?? "通話中にエラーが発生しました");
          setStatus("error");
        });
        deviceRef.current = device;

        const call: Call = await device.connect(
          voicePreset ? { params: { voicePreset } } : {},
        );
        call.on("accept", () => setStatus("connected"));
        call.on("disconnect", () => {
          setStatus("idle");
          destroyDevice();
        });
        call.on("error", (e: { message?: string }) => {
          setError(e.message ?? "通話中にエラーが発生しました");
          setStatus("error");
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "通話を開始できませんでした");
        setStatus("error");
      }
    },
    [destroyDevice],
  );

  const endCall = useCallback(() => {
    deviceRef.current?.disconnectAll();
    destroyDevice();
    setStatus("idle");
  }, [destroyDevice]);

  return { status, error, startCall, endCall };
};
