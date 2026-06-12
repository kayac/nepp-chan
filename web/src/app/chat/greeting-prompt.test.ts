import { describe, expect, it } from "vitest";

import {
  buildGreetingPrompt,
  GREETING_PROMPT,
  isGreetingPrompt,
} from "./greeting-prompt";

describe("buildGreetingPrompt", () => {
  it("location が null なら汎用の挨拶プロンプトを返す", () => {
    expect(buildGreetingPrompt(null)).toBe(GREETING_PROMPT);
  });

  it("location があればその場所への歓迎を依頼するプロンプトを返す", () => {
    const prompt = buildGreetingPrompt("天塩川温泉");
    expect(prompt).toContain("天塩川温泉");
    expect(prompt).toContain("歓迎");
  });
});

describe("isGreetingPrompt", () => {
  it("汎用の挨拶プロンプトを greeting と判定する", () => {
    expect(isGreetingPrompt(GREETING_PROMPT)).toBe(true);
  });

  it("location 入りの挨拶プロンプトも greeting と判定する", () => {
    expect(isGreetingPrompt(buildGreetingPrompt("天塩川温泉"))).toBe(true);
  });

  it("通常のユーザー発話は greeting と判定しない", () => {
    expect(isGreetingPrompt("こんにちは")).toBe(false);
  });

  it("同じ接頭辞で始まる通常発話は greeting と判定しない", () => {
    expect(
      isGreetingPrompt("新しい会話が始まりました。今日は何をしようかな"),
    ).toBe(false);
  });
});
