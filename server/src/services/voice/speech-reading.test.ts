import { describe, expect, it } from "vitest";
import { createSpeechReader, toSpeechReading } from "./speech-reading";

describe("toSpeechReading", () => {
  it("村の固有名詞を読みに置き換える", () => {
    expect(toSpeechReading("音威子府村へようこそ")).toBe(
      "おといねっぷ村へようこそ",
    );
  });

  it("時刻を「時」「分」で読ませる", () => {
    expect(toSpeechReading("9:00に開くよ")).toBe("9時に開くよ");
    expect(toSpeechReading("17:30まで")).toBe("17時30分まで");
    expect(toSpeechReading("8:05発")).toBe("8時5分発");
  });

  it("数字の前の波ダッシュを「から」と読ませる", () => {
    expect(toSpeechReading("9:00〜17:00")).toBe("9時から17時");
    expect(toSpeechReading("10:00~12:00")).toBe("10時から12時");
    expect(toSpeechReading("3〜4日")).toBe("3から4日");
  });

  it("時刻の間のハイフンを「から」と読ませる", () => {
    expect(toSpeechReading("9:00-17:00")).toBe("9時から17時");
  });

  it("曜日の間の波ダッシュを「から」と読ませる", () => {
    expect(toSpeechReading("月〜金は開いてるよ")).toBe("月から金は開いてるよ");
    expect(toSpeechReading("月曜〜金曜")).toBe("月曜から金曜");
  });

  it("語尾を伸ばす波ダッシュはそのまま残す", () => {
    expect(toSpeechReading("また来てね〜")).toBe("また来てね〜");
  });

  it("電話番号の区切りを「の」と読ませる", () => {
    expect(toSpeechReading("01656-5-3311にかけてね")).toBe(
      "01656の5の3311にかけてね",
    );
  });

  it("範囲表記のハイフンは電話番号として扱わない", () => {
    expect(toSpeechReading("3-4日")).toBe("3-4日");
  });
});

describe("createSpeechReader", () => {
  const readAll = (chunks: string[]) => {
    const reader = createSpeechReader();
    const out = chunks.map((chunk) => reader.push(chunk));
    return [...out, reader.flush()];
  };

  it("固有名詞がチャンクをまたいでも読みに置き換える", () => {
    expect(readAll(["ここは音威", "子府だよ"]).join("")).toBe(
      "ここはおといねっぷだよ",
    );
  });

  it("時刻の範囲がチャンクをまたいでも読みに置き換える", () => {
    expect(readAll(["9:", "00〜1", "7:00だよ"]).join("")).toBe(
      "9時から17時だよ",
    );
  });

  it("曜日の範囲がチャンクをまたいでも読みに置き換える", () => {
    expect(readAll(["月曜〜", "金曜だよ"]).join("")).toBe("月曜から金曜だよ");
  });

  it("置き換えの途中になりえない部分はすぐに返す", () => {
    const reader = createSpeechReader();
    expect(reader.push("こんにちは、")).toBe("こんにちは、");
  });

  it("置き換えの途中かもしれない末尾は次のチャンクまで保留する", () => {
    const reader = createSpeechReader();
    expect(reader.push("開館は9")).toBe("開館は");
    expect(reader.push("時だよ")).toBe("9時だよ");
  });

  it("flush で保留分を置き換えて返す", () => {
    const reader = createSpeechReader();
    expect(reader.push("電話は01656-5-3311")).toBe("電話は");
    expect(reader.flush()).toBe("01656の5の3311");
  });
});
