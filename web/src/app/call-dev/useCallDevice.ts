import { type Call, Device } from "@twilio/voice-sdk";
import { useCallback, useRef, useState } from "react";
import { fetchCallToken } from "./api";

export type CallStatus = "idle" | "connecting" | "connected" | "error";

export const useCallDevice = () => {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);

  const startCall = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const { token } = await fetchCallToken();
      const device = new Device(token, { logLevel: "error" });
      deviceRef.current = device;

      const call: Call = await device.connect();
      call.on("accept", () => setStatus("connected"));
      call.on("disconnect", () => setStatus("idle"));
      call.on("error", (e: { message?: string }) => {
        setError(e.message ?? "通話中にエラーが発生しました");
        setStatus("error");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "通話を開始できませんでした");
      setStatus("error");
    }
  }, []);

  const endCall = useCallback(() => {
    deviceRef.current?.disconnectAll();
    deviceRef.current?.destroy();
    deviceRef.current = null;
    setStatus("idle");
  }, []);

  return { status, error, startCall, endCall };
};
