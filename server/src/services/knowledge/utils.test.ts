import { describe, expect, it } from "vitest";

import { extractBaseName, markdownBaseName } from "./utils";

describe("extractBaseName", () => {
  it("originals/ プレフィックスを除去", () => {
    expect(extractBaseName("originals/doc.md")).toBe("doc");
  });

  it("拡張子を除去", () => {
    expect(extractBaseName("foo.pdf")).toBe("foo");
  });

  it("両方除去", () => {
    expect(extractBaseName("originals/data.csv")).toBe("data");
  });

  it("拡張子が無いときはそのまま", () => {
    expect(extractBaseName("README")).toBe("README");
  });

  it("複数のドットがある場合は最後の拡張子のみ削除", () => {
    expect(extractBaseName("originals/my.file.name.txt")).toBe("my.file.name");
  });
});

describe("markdownBaseName", () => {
  it(".md を外す。無ければそのまま", () => {
    expect(markdownBaseName("a/b.md")).toBe("a/b");
    expect(markdownBaseName("a/b")).toBe("a/b");
  });
});
