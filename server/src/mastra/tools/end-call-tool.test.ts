import { describe, expect, it, vi } from "vitest";
import { callTool } from "~/__tests__/helpers/tool-context";
import { endCallTool } from "./end-call-tool";

describe("endCallTool", () => {
  it("voiceEndCall コールバックを呼んで ok を返す", async () => {
    const voiceEndCall = vi.fn();
    const result = await callTool(endCallTool, {}, { voiceEndCall });
    expect(voiceEndCall).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("voiceEndCall が無い（voice 以外）場合はエラーを返す", async () => {
    const result = await callTool(endCallTool, {}, {});
    expect(result).toEqual({
      ok: false,
      message: "通話中ではないため終了できません",
    });
  });
});
