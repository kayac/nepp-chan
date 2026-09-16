import { describe, expect, it } from "vitest";
import {
  classifySegment,
  normalizeSentiment,
  normalizeTopic,
  personaAttributes,
} from "./persona-attributes";

describe("personaAttributes", () => {
  it("tags と demographicSummary を連結する", () => {
    expect(
      personaAttributes({ tags: "そば", demographicSummary: "30代,観光客" }),
    ).toBe("そば,30代,観光客");
  });

  it("null は落として連結する", () => {
    expect(personaAttributes({ tags: null, demographicSummary: "村人" })).toBe(
      "村人",
    );
    expect(personaAttributes({ tags: null, demographicSummary: null })).toBe(
      "",
    );
  });
});

describe("classifySegment", () => {
  it("観光客の類義語を観光客に寄せる", () => {
    expect(classifySegment("30代,観光客")).toBe("観光客");
    expect(classifySegment("旅行者,そば")).toBe("観光客");
    expect(classifySegment("旅行検討者")).toBe("観光客");
    expect(classifySegment("観光検討者")).toBe("観光客");
    expect(classifySegment("訪問検討者")).toBe("観光客");
    expect(classifySegment("旅行客")).toBe("観光客");
  });

  it("移住検討者の類義語を移住検討者に寄せる", () => {
    expect(classifySegment("移住希望,30代")).toBe("移住検討者");
    expect(classifySegment("移住を検討中")).toBe("移住検討者");
  });

  it("帰省を帰省者に寄せる", () => {
    expect(classifySegment("帰省中,20代")).toBe("帰省者");
  });

  it("村人・村内・移住者を村内住民に寄せる", () => {
    expect(classifySegment("村人")).toBe("村内住民");
    expect(classifySegment("60代,村内")).toBe("村内住民");
    expect(classifySegment("移住者,子育て")).toBe("村内住民");
  });

  it("居住地を特定しない在住だけでは分類しない", () => {
    expect(classifySegment("札幌在住")).toBe("不明セグメント");
  });

  it("村外は村外", () => {
    expect(classifySegment("40代,村外")).toBe("村外");
  });

  it("複数該当したら具体的な関係性を居住地より優先する", () => {
    expect(classifySegment("移住検討者,村人")).toBe("移住検討者");
    expect(classifySegment("村外,観光客")).toBe("観光客");
    expect(classifySegment("村内,帰省")).toBe("帰省者");
  });

  it("観光・旅行のトピック語だけでは分類しない", () => {
    expect(classifySegment("観光,旅行,そば")).toBe("不明セグメント");
  });

  it("該当なしと空文字は不明セグメント", () => {
    expect(classifySegment("40代,子育て")).toBe("不明セグメント");
    expect(classifySegment("")).toBe("不明セグメント");
  });
});

describe("normalizeSentiment", () => {
  it("既知の値はそのまま返す", () => {
    expect(normalizeSentiment("negative")).toBe("negative");
  });

  it("未知の値と null は neutral に寄せる", () => {
    expect(normalizeSentiment("angry")).toBe("neutral");
    expect(normalizeSentiment(null)).toBe("neutral");
  });
});

describe("normalizeTopic", () => {
  it("既知の話題はそのまま返す", () => {
    expect(normalizeTopic("除雪")).toBe("除雪");
  });

  it("未知の話題と null は その他 に寄せる", () => {
    expect(normalizeTopic("ふるさと納税")).toBe("その他");
    expect(normalizeTopic(null)).toBe("その他");
  });
});
