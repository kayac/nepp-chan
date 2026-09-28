import { describe, expect, it } from "vitest";
import {
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
