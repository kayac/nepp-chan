import { describe, expect, it } from "vitest";
import {
  addUrls,
  extractUrls,
  hasDraftInput,
  hostLabel,
  isCuratedKey,
  isValidSlug,
  joinDraft,
  keyFromSlug,
  slugFromKey,
  splitDraft,
  toDraftRequest,
} from "./helpers";

const file = new File(["x"], "f.png", { type: "image/png" });

describe("isCuratedKey", () => {
  it("curated/ 配下だけ真", () => {
    expect(isCuratedKey("curated/usagi.md")).toBe(true);
    expect(isCuratedKey("villotoinep/index.md")).toBe(false);
    expect(isCuratedKey("welcome-guide.md")).toBe(false);
  });
});

describe("slugFromKey / keyFromSlug", () => {
  it("curated/ と .md を外した slug と、その逆変換", () => {
    expect(slugFromKey("curated/otoineppu-tokyo.md")).toBe("otoineppu-tokyo");
    expect(keyFromSlug(" otoineppu-tokyo ")).toBe("curated/otoineppu-tokyo.md");
  });
});

describe("isValidSlug", () => {
  it("空と / 入りは不可", () => {
    expect(isValidSlug("usagi")).toBe(true);
    expect(isValidSlug("  ")).toBe(false);
    expect(isValidSlug("a/b")).toBe(false);
  });
});

describe("extractUrls", () => {
  it("文章の中の URL を重複なしで拾い、全角括弧や句読点で切る", () => {
    expect(
      extractUrls(
        "公式は https://peraichi.com/x です（https://x.com/a/status/1）。再掲 https://peraichi.com/x",
      ),
    ).toEqual(["https://peraichi.com/x", "https://x.com/a/status/1"]);
  });

  it("URL が無ければ空", () => {
    expect(extractUrls("音威子府の店")).toEqual([]);
  });
});

describe("addUrls", () => {
  it("貼られた文字列から URL を拾って重複なく足し、上限で切る", () => {
    expect(
      addUrls(
        ["https://a.example/"],
        "https://a.example/ https://b.example/",
        10,
      ),
    ).toEqual({
      urls: ["https://a.example/", "https://b.example/"],
      accepted: true,
    });
    expect(addUrls(["https://a.example/"], "https://b.example/", 1)).toEqual({
      urls: ["https://a.example/"],
      accepted: true,
    });
  });

  it("URL が無ければ accepted は偽で元のまま", () => {
    expect(addUrls(["https://a.example/"], "店名", 10)).toEqual({
      urls: ["https://a.example/"],
      accepted: false,
    });
  });
});

describe("toDraftRequest", () => {
  const base = {
    urls: ["https://a.example/"],
    text: "メモ https://b.example/",
    files: [file],
  };

  it("URL から作る: URL 欄だけを使い、空行と重複を除く", () => {
    expect(
      toDraftRequest({
        ...base,
        kind: "url",
        urls: [" https://a.example/ ", "", "https://a.example/"],
      }),
    ).toEqual({ urls: ["https://a.example/"], files: [] });
  });

  it("文章から作る: 文章と、文中の URL だけを使う", () => {
    expect(toDraftRequest({ ...base, kind: "text" })).toEqual({
      urls: ["https://b.example/"],
      text: "メモ https://b.example/",
      files: [],
    });
  });

  it("画像・PDF から作る: ファイルだけを使う", () => {
    expect(toDraftRequest({ ...base, kind: "files" })).toEqual({
      urls: [],
      files: [file],
    });
  });
});

describe("hasDraftInput", () => {
  it("表示中の種類の入力だけで判定する", () => {
    expect(
      hasDraftInput({ kind: "url", urls: [""], text: "メモ", files: [file] }),
    ).toBe(false);
    expect(
      hasDraftInput({
        kind: "url",
        urls: ["https://a.example/"],
        text: "",
        files: [],
      }),
    ).toBe(true);
    expect(
      hasDraftInput({ kind: "text", urls: [], text: "  ", files: [file] }),
    ).toBe(false);
    expect(
      hasDraftInput({ kind: "text", urls: [], text: "メモ", files: [] }),
    ).toBe(true);
    expect(
      hasDraftInput({
        kind: "files",
        urls: ["https://a.example/"],
        text: "",
        files: [],
      }),
    ).toBe(false);
    expect(
      hasDraftInput({ kind: "files", urls: [], text: "", files: [file] }),
    ).toBe(true);
  });
});

describe("splitDraft / joinDraft", () => {
  const content =
    "---\ntitle: 音威子府TOKYO（そば）\ncategory: お店・スポット\n---\n# 音威子府TOKYO（そば）\n\n> 注意\n\n本文\n";

  it("frontmatter・見出しのタイトル・本文に分ける", () => {
    expect(splitDraft(content)).toEqual({
      frontmatter:
        "---\ntitle: 音威子府TOKYO（そば）\ncategory: お店・スポット\n---\n",
      title: "音威子府TOKYO（そば）",
      body: "> 注意\n\n本文\n",
    });
  });

  it("見出しが無ければ frontmatter の title を使い、本文はそのまま", () => {
    expect(splitDraft("---\ntitle: 'A: B'\n---\n本文\n")).toEqual({
      frontmatter: "---\ntitle: 'A: B'\n---\n",
      title: "A: B",
      body: "本文\n",
    });
  });

  it("frontmatter が無ければ全部本文", () => {
    expect(splitDraft("本文だけ\n")).toEqual({
      frontmatter: "",
      title: "",
      body: "本文だけ\n",
    });
  });

  it("分けたものを結合すると元に戻り、タイトル変更は frontmatter と見出しの両方に反映される", () => {
    expect(joinDraft(splitDraft(content))).toBe(content);
    expect(
      joinDraft({ ...splitDraft(content), title: "新しい名前: 補足" }),
    ).toBe(
      "---\ntitle: '新しい名前: 補足'\ncategory: お店・スポット\n---\n# 新しい名前: 補足\n\n> 注意\n\n本文\n",
    );
  });
});

describe("hostLabel", () => {
  it("www とルートの / を落として host + path にする", () => {
    expect(hostLabel("https://www.peraichi.com/landing_pages/view/x")).toBe(
      "peraichi.com/landing_pages/view/x",
    );
    expect(hostLabel("https://example.com/")).toBe("example.com");
  });

  it("URL でなければそのまま返す", () => {
    expect(hostLabel("検索: 店名")).toBe("検索: 店名");
  });
});
