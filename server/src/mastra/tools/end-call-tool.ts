import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getVoiceEndCall } from "./helpers";

export const endCallToolName = "endCallTool";

export const endCallTool = createTool({
  id: "end-call",
  description:
    "音声通話を終了します。ユーザーが会話を終える意思（さようなら、切るね等）を示し、お別れの言葉を伝え終えたときに呼びます。",
  inputSchema: z.object({}),
  execute: async (_inputData, context) => {
    const endCall = getVoiceEndCall(context);
    if (!endCall) {
      return { ok: false, message: "通話中ではないため終了できません" };
    }
    endCall();
    return { ok: true };
  },
});
