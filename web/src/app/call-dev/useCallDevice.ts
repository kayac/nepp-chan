import { type Call, Device } from "@twilio/voice-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCallToken } from "./api";

export type CallStatus = "idle" | "connecting" | "connected" | "error";

export const useCallDevice = () => {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callAttemptRef = useRef(0);

  const destroyDevice = useCallback(() => {
    deviceRef.current?.destroy();
    deviceRef.current = null;
  }, []);

  const startCall = useCallback(
    async (params?: Record<string, string>) => {
      const callAttempt = ++callAttemptRef.current;
      const isCurrentAttempt = () => callAttempt === callAttemptRef.current;
      setError(null);
      setStatus("connecting");
      destroyDevice();
      try {
        const { token } = await fetchCallToken();
        if (!isCurrentAttempt()) return;
        const device = new Device(token, { logLevel: "error" });
        // トークン期限切れ等は Call ではなく Device が 'error' を emit する。
        device.on("error", (e: { message?: string }) => {
          if (!isCurrentAttempt()) return;
          setError(e.message ?? "通話中にエラーが発生しました");
          setStatus("error");
        });
        deviceRef.current = device;

        const call: Call = await device.connect(
          params && Object.keys(params).length > 0 ? { params } : {},
        );
        if (!isCurrentAttempt()) return;
        call.on("accept", () => {
          if (isCurrentAttempt()) setStatus("connected");
        });
        call.on("disconnect", () => {
          if (!isCurrentAttempt()) return;
          setStatus("idle");
          destroyDevice();
        });
        call.on("error", (e: { message?: string }) => {
          if (!isCurrentAttempt()) return;
          setError(e.message ?? "通話中にエラーが発生しました");
          setStatus("error");
        });
      } catch (e) {
        if (!isCurrentAttempt()) return;
        setError(e instanceof Error ? e.message : "通話を開始できませんでした");
        setStatus("error");
      }
    },
    [destroyDevice],
  );

  const endCall = useCallback(() => {
    callAttemptRef.current++;
    deviceRef.current?.disconnectAll();
    destroyDevice();
    setStatus("idle");
  }, [destroyDevice]);

  useEffect(
    () => () => {
      callAttemptRef.current++;
      destroyDevice();
    },
    [destroyDevice],
  );

  return { status, error, startCall, endCall };
};
