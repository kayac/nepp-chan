import { DISPLAY_TOOL_NAMES } from "@nepp-chan/shared/constants/display-tools";
import { describe, expect, it } from "vitest";

import { type AgentModelConfig, GEMINI_FLASH_LITE } from "~/lib/llm-models";
import { broadcastGetToolName } from "~/mastra/tools/broadcast-get-tool";
import { pollGetToolName } from "~/mastra/tools/poll-get-tool";
import { voiceAnswerToolName } from "~/mastra/tools/voice-answer-tool";
import { createNeppChanAgent, neppChanMemoryOptions } from "./nepp-chan-agent";

const modelConfig = { model: "dummy-model" } as unknown as AgentModelConfig;

const build = (over: Partial<Parameters<typeof createNeppChanAgent>[0]> = {}) =>
  createNeppChanAgent({ modelConfig, withMemory: false, ...over });

const instructionsOf = async (agent: ReturnType<typeof createNeppChanAgent>) =>
  String(
    await (
      agent as unknown as {
        getInstructions: (a?: unknown) => Promise<string>;
      }
    ).getInstructions({}),
  );

describe("createNeppChanAgent", () => {
  describe("instructions の合成", () => {
    it("デフォルト（web / 非 admin）は LINE・管理者向けの指示を含まない", async () => {
      const ins = await instructionsOf(build());
      expect(ins).not.toContain("LINE チャットの制約");
      expect(ins).not.toContain("管理者機能");
    });

    it("isAdmin=true で管理者機能の指示を追加する", async () => {
      const ins = await instructionsOf(build({ isAdmin: true }));
      expect(ins).toContain("管理者機能");
    });

    it("isAdmin=true で文脈付き分析依頼の返答型を含む", async () => {
      const ins = await instructionsOf(build({ isAdmin: true }));
      expect(ins).toContain("文脈付きの分析依頼");
      const nonAdmin = await instructionsOf(build());
      expect(nonAdmin).not.toContain("文脈付きの分析依頼");
    });

    it("platform=line で LINE 制約の指示を追加する", async () => {
      const ins = await instructionsOf(build({ platform: "line" }));
      expect(ins).toContain("LINE チャットの制約");
      // LINE では admin 指示は付かない（非 admin 既定）
      expect(ins).not.toContain("管理者機能");
    });

    it("常に現在の日時セクションを含む", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("現在の日時");
    });

    it("ツールはモデルに公開される toolName（登録キー）で参照する", async () => {
      const ins = await instructionsOf(build({ isAdmin: true }));
      expect(ins).toContain(DISPLAY_TOOL_NAMES.chart);
      expect(ins).toContain(DISPLAY_TOOL_NAMES.table);
      expect(ins).toContain(DISPLAY_TOOL_NAMES.timeline);
      expect(ins).toContain(pollGetToolName);

      const lineIns = await instructionsOf(build({ platform: "line" }));
      expect(lineIns).toContain(broadcastGetToolName);
    });

    it("platform=voice は voiceAnswerTool を登録キーで参照する", async () => {
      const ins = await instructionsOf(build({ platform: "voice" }));
      expect(ins).toContain(voiceAnswerToolName);
      expect(ins).not.toMatch(/voiceAnswer(?!Tool)/);
    });

    it("platform=voice は事実の質問で前置きせず直ちにツールを呼ぶ", async () => {
      const ins = await instructionsOf(build({ platform: "voice" }));
      expect(ins).toContain("前置きせず直ちに");
      expect(ins).not.toContain("呼ぶ前に1文だけ前置き");
    });

    it("platform=voice の例文に絵文字を含めない", async () => {
      const ins = await instructionsOf(build({ platform: "voice" }));
      expect(ins).not.toMatch(/[🌸😊]/u);
    });
  });

  describe("platform / isAdmin による Agent 構築", () => {
    it.each([
      ["web 一般", { platform: "web" as const, isAdmin: false }],
      ["web 管理者", { platform: "web" as const, isAdmin: true }],
      ["line", { platform: "line" as const, isAdmin: false }],
      ["widget", { platform: "widget" as const, isAdmin: false }],
      ["voice", { platform: "voice" as const, isAdmin: false }],
    ])("%s で Agent を生成できる", (_label, over) => {
      expect(build(over)).toBeDefined();
    });

    it("withMemory=true でも生成できる（memory を wiring する分岐）", () => {
      expect(build({ withMemory: true })).toBeDefined();
    });
  });

  describe("memory オプション", () => {
    it("タイトル生成は FLASH_LITE + 日本語指示で行う", () => {
      expect(neppChanMemoryOptions.generateTitle.model).toBe(GEMINI_FLASH_LITE);
      expect(neppChanMemoryOptions.generateTitle.instructions).toContain(
        "日本語",
      );
    });

    it("working memory は resource スコープで有効", () => {
      expect(neppChanMemoryOptions.workingMemory).toMatchObject({
        enabled: true,
        scope: "resource",
      });
    });
  });
});
