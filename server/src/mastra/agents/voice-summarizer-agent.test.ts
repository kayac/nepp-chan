import { describe, expect, it } from "vitest";
import {
  NEED_KNOWLEDGE,
  NEED_WEB,
  voiceSummarizerAgent,
} from "./voice-summarizer-agent";

const instructionsOf = async () =>
  String(
    await (
      voiceSummarizerAgent as unknown as {
        getInstructions: (a?: unknown) => Promise<string>;
      }
    ).getInstructions({}),
  );

describe("voiceSummarizerAgent", () => {
  it("資料で答えられないときの委譲シグナルを指示に含む", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain(NEED_KNOWLEDGE);
    expect(ins).toContain(NEED_WEB);
  });
});
