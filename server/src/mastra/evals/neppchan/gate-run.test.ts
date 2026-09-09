import { getTextContentFromMastraDBMessage } from "@mastra/evals/scorers/utils";
import { describe, expect, it } from "vitest";
import { buildGateRun } from "./gate-run";
import { calledTools } from "./graders";

const texts = (run: ReturnType<typeof buildGateRun>["run"]) =>
  run.output.map((m) => getTextContentFromMastraDBMessage(m));

describe("buildGateRun", () => {
  it("前置き step と本文を別の assistant メッセージにし、本文にツールを載せる", () => {
    const { run, text } = buildGateRun({
      turns: ["そばのこと教えて"],
      stepTexts: ["気になるよね！調べてくるね🍜", "本文だよ"],
      finalText: "本文だよ\n",
      tools: ["agent-knowledgeAgent"],
    });
    expect(texts(run)).toEqual(["気になるよね！調べてくるね🍜", "本文だよ"]);
    expect(calledTools(run.output)).toEqual(["agent-knowledgeAgent"]);
    expect(text).toBe("気になるよね！調べてくるね🍜\n\n本文だよ");
    expect(
      run.input.inputMessages.map((m) => getTextContentFromMastraDBMessage(m)),
    ).toEqual(["そばのこと教えて"]);
  });

  it("step が 1 つなら前置きは無い", () => {
    const { run, text } = buildGateRun({
      turns: ["こんにちは"],
      stepTexts: ["こんにちは〜！"],
      finalText: "こんにちは〜！",
      tools: [],
    });
    expect(texts(run)).toEqual(["こんにちは〜！"]);
    expect(text).toBe("こんにちは〜！");
  });

  it("検索後に説明を挟んで再検索した場合、本文以外の step はまとめて前置きになる", () => {
    const { run } = buildGateRun({
      turns: ["人口の推移をグラフに"],
      stepTexts: ["調べてくるね", "途中の数字が見えたよ", "本文だよ"],
      finalText: "本文だよ",
      tools: [],
    });
    expect(texts(run)).toEqual([
      "調べてくるね\n\n途中の数字が見えたよ",
      "本文だよ",
    ]);
  });
});
