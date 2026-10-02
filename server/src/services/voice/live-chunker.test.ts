import { describe, expect, it } from "vitest";
import { splitForAppend, takeChunk } from "./live-chunker";

describe("takeChunk", () => {
  it("文末まで溜まっていなければ何も切り出さない", () => {
    expect(takeChunk("音威子府そばは", false)).toEqual({
      chunk: "",
      rest: "音威子府そばは",
    });
  });

  it("文末まで来たらそこまでを切り出して残りを持ち越す", () => {
    expect(takeChunk("黒い麺だよ。温かいのも冷たいのも", false)).toEqual({
      chunk: "黒い麺だよ。",
      rest: "温かいのも冷たいのも",
    });
  });

  it("複数の文が溜まっていれば最後の文末までまとめて出す", () => {
    expect(takeChunk("そうだよ。美味しいよ。あとね", false)).toEqual({
      chunk: "そうだよ。美味しいよ。",
      rest: "あとね",
    });
  });

  it("！ ？ ! ? も文末として扱う", () => {
    expect(takeChunk("すごいね！それでね", false).chunk).toBe("すごいね！");
    expect(takeChunk("そうなの?でもね", false).chunk).toBe("そうなの?");
  });

  it("flush なら文末が無くても全部出す", () => {
    expect(takeChunk("まだ途中だけど", true)).toEqual({
      chunk: "まだ途中だけど",
      rest: "",
    });
  });

  it("文末が来なくても上限に達したら切る", () => {
    const long = "あ".repeat(400);
    const { chunk, rest } = takeChunk(long, false);
    expect(chunk).toHaveLength(350);
    expect(rest).toHaveLength(50);
  });

  it("flush で空文字なら空を返す", () => {
    expect(takeChunk("   ", true)).toEqual({ chunk: "", rest: "" });
  });
});

describe("splitForAppend", () => {
  it("上限内ならそのまま 1 つ", () => {
    expect(splitForAppend("短い文だよ")).toEqual(["短い文だよ"]);
  });

  it("上限を超える文は上限ごとに割る", () => {
    const parts = splitForAppend("あ".repeat(800));
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(350);
    expect(parts[2]).toHaveLength(100);
  });

  it("空文字なら何も返さない", () => {
    expect(splitForAppend("  ")).toEqual([]);
  });
});
