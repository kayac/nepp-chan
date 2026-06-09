import { describe, expect, it } from "vitest";

import { buildOriginalsMap, EDIT_THRESHOLD_MS, extractBaseName } from "./utils";

describe("EDIT_THRESHOLD_MS", () => {
  it("5000 ミリ秒で定義されている", () => {
    expect(EDIT_THRESHOLD_MS).toBe(5000);
  });
});

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

describe("buildOriginalsMap", () => {
  const obj = (key: string, date: string): R2Object =>
    ({ key, uploaded: new Date(date) }) as R2Object;

  it("originals/ プレフィックスのオブジェクトだけ Map に入れる", () => {
    const result = buildOriginalsMap([
      obj("originals/a.md", "2030-01-01T00:00:00Z"),
      obj("normal/b.md", "2030-01-02T00:00:00Z"),
      obj("originals/c.pdf", "2030-01-03T00:00:00Z"),
    ]);

    expect(result.size).toBe(2);
    expect(result.has("a")).toBe(true);
    expect(result.has("c")).toBe(true);
    expect(result.has("b")).toBe(false);
  });

  it("値は R2Object の uploaded Date", () => {
    const map = buildOriginalsMap([
      obj("originals/x.md", "2030-05-05T12:00:00Z"),
    ]);
    expect(map.get("x")).toEqual(new Date("2030-05-05T12:00:00Z"));
  });

  it("空配列なら空 Map", () => {
    expect(buildOriginalsMap([]).size).toBe(0);
  });
});
