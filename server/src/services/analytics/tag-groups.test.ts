import { describe, expect, it } from "vitest";
import {
  aggregateAudiences,
  collectUnassignedTags,
  collectUnmappedTags,
  countTags,
  normalizeTag,
  partitionByPriority,
  resolveGroups,
  sanitizeAssignments,
  splitAttributes,
  type TagGroup,
} from "./tag-groups";

const groups: TagGroup[] = [
  {
    id: "tourist",
    name: "観光客",
    kind: "attribute",
    axis: "関わり",
    sortOrder: 10,
  },
  {
    id: "resident",
    name: "村内住民",
    kind: "attribute",
    axis: "関わり",
    sortOrder: 40,
  },
  {
    id: "outsider",
    name: "村外",
    kind: "attribute",
    axis: "関わり",
    sortOrder: 50,
  },
  {
    id: "teens",
    name: "10代",
    kind: "attribute",
    axis: "年代",
    sortOrder: 110,
  },
  { id: "topic-food", name: "食", kind: "topic", axis: null, sortOrder: 1020 },
  { id: "exclude", name: "除外", kind: "exclude", axis: null, sortOrder: 9000 },
];

const aliases = new Map<string, string | null>([
  ["観光客", "tourist"],
  ["旅行者", "tourist"],
  ["村内", "resident"],
  ["村外", "outsider"],
  ["高校生", "teens"],
  ["そば", "topic-food"],
  ["関心事", "exclude"],
  ["謎タグ", null],
]);

describe("splitAttributes", () => {
  it("カンマで分解して trim と NFKC 正規化をかけ、空要素と重複を落とす", () => {
    expect(splitAttributes("観光客, ｿﾊﾞ,,観光客,　村外")).toEqual([
      "観光客",
      "ソバ",
      "村外",
    ]);
  });

  it("全角カンマも区切りとして扱う", () => {
    expect(splitAttributes("観光客、村外")).toEqual(["観光客", "村外"]);
  });
});

describe("normalizeTag", () => {
  it("前後の空白を落として NFKC に寄せる", () => {
    expect(normalizeTag(" ＡＩ ")).toBe("AI");
  });
});

describe("resolveGroups", () => {
  it("別名表を介してタグをグループに解決し、同じグループは 1 回だけ返す", () => {
    expect(
      resolveGroups("観光客,旅行者,そば", aliases, groups).map((g) => g.id),
    ).toEqual(["tourist", "topic-food"]);
  });

  it("未登録タグ・未分類タグ・除外グループは結果に含めない", () => {
    expect(resolveGroups("未知,謎タグ,関心事", aliases, groups)).toEqual([]);
  });
});

describe("partitionByPriority", () => {
  it("同じ軸のグループから sortOrder が最小のものを選ぶ", () => {
    const resolved = resolveGroups("村外,観光客", aliases, groups);
    expect(partitionByPriority(resolved, "関わり")?.name).toBe("観光客");
  });

  it("その軸のグループが無ければ null", () => {
    const resolved = resolveGroups("高校生", aliases, groups);
    expect(partitionByPriority(resolved, "関わり")).toBeNull();
  });
});

describe("aggregateAudiences", () => {
  const row = (
    over: Partial<Parameters<typeof aggregateAudiences>[0][number]>,
  ) => ({
    tags: null,
    demographicSummary: null,
    topic: "観光",
    sentiment: "neutral",
    entities: null,
    content: "テスト",
    conversationEndedAt: "2026-06-01T00:00:00.000Z",
    ...over,
  });

  it("属性グループごとに件数・話題 × 感情・固有名詞・話題タグを集計する", () => {
    const rows = [
      row({
        tags: "観光客,そば",
        topic: "観光",
        sentiment: "positive",
        entities: JSON.stringify([{ name: "音威子府駅", type: "facility" }]),
      }),
      row({
        tags: "旅行者",
        demographicSummary: "村外",
        topic: "交通",
        sentiment: "request",
        entities: JSON.stringify([{ name: "音威子府駅", type: "facility" }]),
      }),
      row({ tags: "村内", topic: "除雪", sentiment: "negative" }),
    ];

    const result = aggregateAudiences(rows, groups, aliases);

    const kanko = result.axes
      .find((a) => a.axis === "関わり")
      ?.groups.find((g) => g.id === "tourist");
    expect(kanko?.count).toBe(2);
    expect(kanko?.topics).toEqual(
      expect.arrayContaining([
        { topic: "観光", positive: 1, negative: 0, request: 0, neutral: 0 },
        { topic: "交通", positive: 0, negative: 0, request: 1, neutral: 0 },
      ]),
    );
    expect(kanko?.entities).toEqual([{ name: "音威子府駅", count: 2 }]);
    expect(kanko?.tags).toEqual([{ tag: "食", count: 1 }]);
  });

  it("同じ行が同軸の複数グループに入るので、件数は排他ではない", () => {
    const result = aggregateAudiences(
      [row({ tags: "観光客,村外" })],
      groups,
      aliases,
    );
    const kakawari = result.axes.find((a) => a.axis === "関わり");
    expect(kakawari?.groups.map((g) => [g.id, g.count])).toEqual(
      expect.arrayContaining([
        ["tourist", 1],
        ["outsider", 1],
      ]),
    );
  });

  it("代表の声は negative / request を優先し、次に新しい順で 2 件", () => {
    const result = aggregateAudiences(
      [
        row({
          tags: "観光客",
          content: "古い中立",
          sentiment: "neutral",
          conversationEndedAt: "2026-01-01T00:00:00.000Z",
        }),
        row({
          tags: "観光客",
          content: "新しい中立",
          sentiment: "neutral",
          conversationEndedAt: "2026-06-01T00:00:00.000Z",
        }),
        row({
          tags: "観光客",
          content: "古い不満",
          sentiment: "negative",
          conversationEndedAt: "2026-02-01T00:00:00.000Z",
        }),
        row({
          tags: "観光客",
          content: "新しい要望",
          sentiment: "request",
          conversationEndedAt: "2026-05-01T00:00:00.000Z",
        }),
      ],
      groups,
      aliases,
    );
    const kanko = result.axes[0]?.groups.find((g) => g.id === "tourist");
    expect(kanko?.samples.map((s) => s.content)).toEqual([
      "新しい要望",
      "古い不満",
    ]);
  });

  it("件数 0 の属性グループは出さず、軸は sortOrder 順に並ぶ", () => {
    const result = aggregateAudiences(
      [row({ tags: "高校生" })],
      groups,
      aliases,
    );
    expect(result.axes.map((a) => a.axis)).toEqual(["年代"]);
    expect(result.axes[0]?.groups.map((g) => g.id)).toEqual(["teens"]);
  });
});

describe("collectUnassignedTags", () => {
  it("別名表に無いタグと group NULL のタグを件数順に返し、除外・既登録は含めない", () => {
    const rows = [
      { tags: "観光客,新語,関心事", demographicSummary: "謎タグ" },
      { tags: "新語", demographicSummary: null },
    ];
    expect(collectUnassignedTags(countTags(rows), aliases)).toEqual([
      { tag: "新語", count: 2 },
      { tag: "謎タグ", count: 1 },
    ]);
  });
});

describe("collectUnmappedTags", () => {
  it("別名表に一度も登録されていないタグだけを件数順に返す", () => {
    const rows = [
      { tags: "観光客,新語", demographicSummary: "謎タグ" },
      { tags: "新語,別の新語", demographicSummary: null },
    ];
    expect(collectUnmappedTags(countTags(rows), aliases)).toEqual([
      { tag: "新語", count: 2 },
      { tag: "別の新語", count: 1 },
    ]);
  });
});

describe("sanitizeAssignments", () => {
  it("入力に無いタグは捨て、未知の groupId と欠けたタグは null に落とす", () => {
    const result = sanitizeAssignments(
      [
        { tag: "旅行者", groupId: "tourist" },
        { tag: "捏造タグ", groupId: "tourist" },
        { tag: "謎", groupId: "no-such-group" },
      ],
      ["旅行者", "謎", "返答なし"],
      groups,
    );
    expect(result).toEqual([
      { tag: "旅行者", groupId: "tourist" },
      { tag: "謎", groupId: null },
      { tag: "返答なし", groupId: null },
    ]);
  });
});
