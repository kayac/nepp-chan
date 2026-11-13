import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { chunkDocument } = await import("./chunk");

const paragraph = (ch: string, len: number) => ch.repeat(len);

describe("chunkDocument", () => {
  it("見出し階層を title / section / subsection として metadata に載せ、本文の先頭にプレフィックスを付ける", async () => {
    const md = [
      "# 広報おといねっぷ",
      "## 診療所",
      paragraph("あ", 80),
      "### 整形外科",
      paragraph("い", 80),
    ].join("\n\n");

    const { texts, metadata } = await chunkDocument("kouhou.md", md);

    expect(texts).toHaveLength(2);
    expect(texts[0]).toBe(
      `広報おといねっぷ > 診療所\n\n${paragraph("あ", 80)}`,
    );
    expect(texts[1]).toBe(
      `広報おといねっぷ > 診療所 > 整形外科\n\n${paragraph("い", 80)}`,
    );
    expect(metadata[1]).toMatchObject({
      source: "kouhou.md",
      title: "広報おといねっぷ",
      section: "診療所",
      subsection: "整形外科",
      content: texts[1],
    });
  });

  it("frontmatter を metadata に取り込み、本文からは除く", async () => {
    const md = `---\ncategory: faq\ndate: "2026-01-01"\n---\n# T\n\n${paragraph("x", 60)}`;

    const { texts, metadata } = await chunkDocument("faq.md", md);

    expect(metadata[0]).toMatchObject({ category: "faq", date: "2026-01-01" });
    expect(texts[0]).not.toContain("category");
  });

  it("見出しの付く短い節は残し、見出しに本文を添えて埋め込む", async () => {
    const md = `# パスポート\n\n## 申請できる場所\n\n本庁舎でも支所でも申請できる\n\n## 問い合わせ\n\n${paragraph("x", 60)}`;

    const { texts } = await chunkDocument("passport.md", md);

    expect(texts).toHaveLength(2);
    expect(texts[0]).toBe(
      "パスポート > 申請できる場所\n\n本庁舎でも支所でも申請できる",
    );
  });

  it("区切り線やページ番号だけの節は見出しがあっても捨てる", async () => {
    const md =
      "# T\n\n## 区切りだけ\n\n---\n\n## ページ番号\n\n266\n\n## 日程\n\n令和8年3月22日（日）";

    const { texts } = await chunkDocument("doc.md", md);

    expect(texts).toEqual(["T > 日程\n\n令和8年3月22日（日）"]);
  });

  it("見出しの無い 50 文字未満の断片は捨てる", async () => {
    const md = `本文へ移動\n\n# T\n\n${paragraph("x", 60)}`;

    const { texts } = await chunkDocument("doc.md", md);

    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("T");
  });

  it("見出しの無い長いセクションは maxSize で分割し、各片が見出し metadata を保つ", async () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) =>
      paragraph(String(i), 400),
    );
    const md = `# 寄附者一覧\n\n## 令和7年度\n\n${paragraphs.join("\n\n")}`;

    const { texts, metadata } = await chunkDocument("kifu.md", md);

    expect(texts.length).toBeGreaterThan(1);
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(
        1000 + "寄附者一覧 > 令和7年度\n\n".length,
      );
    }
    for (const meta of metadata) {
      expect(meta).toMatchObject({ title: "寄附者一覧", section: "令和7年度" });
    }
  });

  it("見出しが無い文書はプレフィックスなしで本文をそのまま使う", async () => {
    const body = paragraph("c", 100);

    const { texts, metadata } = await chunkDocument("plain.md", body);

    expect(texts).toEqual([body]);
    expect(metadata[0].title).toBeUndefined();
  });
});
