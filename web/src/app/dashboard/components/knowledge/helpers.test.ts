import { describe, expect, it, vi } from "vitest";
import {
  addUrls,
  canDeleteFile,
  collectMarkdownFiles,
  extractUrls,
  hasDraftInput,
  hostLabel,
  isCuratedKey,
  isOfficialKey,
  isUploadableMarkdown,
  isValidSlug,
  joinDraft,
  keyFromSlug,
  pickedFilesToCandidates,
  readAllEntries,
  runWithConcurrency,
  slugFromKey,
  splitDraft,
  splitKey,
  stripTopFolder,
  toDraftRequest,
  toRelativePath,
} from "./helpers";

const file = new File(["x"], "f.png", { type: "image/png" });
const info = (key: string) => ({
  key,
  size: 1,
  lastModified: "2025-01-01T00:00:00Z",
});

describe("isCuratedKey / isOfficialKey", () => {
  it("それぞれのプレフィクス配下だけ真", () => {
    expect(isCuratedKey("curated/usagi.md")).toBe(true);
    expect(isCuratedKey("official/usagi.md")).toBe(false);
    expect(isOfficialKey("official/kurashi/gomi.md")).toBe(true);
    expect(isOfficialKey("curated/usagi.md")).toBe(false);
    expect(isOfficialKey("official.md")).toBe(false);
  });
});

describe("splitKey", () => {
  it("最後の / でディレクトリ部分とファイル名に分ける", () => {
    expect(splitKey("official/kurashi/gomi.md")).toEqual({
      dir: "official/kurashi/",
      name: "gomi.md",
    });
    expect(splitKey("welcome.md")).toEqual({ dir: "", name: "welcome.md" });
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

describe("canDeleteFile", () => {
  it("curated/ か official/ 配下だけ削除できる", () => {
    expect(canDeleteFile(info("curated/usagi.md"))).toBe(true);
    expect(canDeleteFile(info("official/villotoinep/index.md"))).toBe(true);
    expect(canDeleteFile(info("villotoinep/index.md"))).toBe(false);
    expect(canDeleteFile(info("chirashi.md"))).toBe(false);
  });
});

describe("toRelativePath", () => {
  it("先頭の / を落とし、それ以外は変えない", () => {
    expect(toRelativePath("/kurashi/gomi.md")).toBe("kurashi/gomi.md");
    expect(toRelativePath("//a.md")).toBe("a.md");
    expect(toRelativePath("kurashi/gomi.md")).toBe("kurashi/gomi.md");
  });
});

describe("stripTopFolder", () => {
  it("先頭のフォルダ名だけを落とし、フォルダが無ければそのまま", () => {
    expect(stripTopFolder("knowledge/kurashi/gomi.md")).toBe("kurashi/gomi.md");
    expect(stripTopFolder("knowledge/index.md")).toBe("index.md");
    expect(stripTopFolder("top.md")).toBe("top.md");
  });
});

describe("isUploadableMarkdown", () => {
  it(".md だけを受け付ける", () => {
    expect(isUploadableMarkdown("kurashi/gomi.md")).toBe(true);
    expect(isUploadableMarkdown("gomi.md")).toBe(true);
    expect(isUploadableMarkdown("gomi.txt")).toBe(false);
    expect(isUploadableMarkdown("gomi.MD")).toBe(false);
    expect(isUploadableMarkdown("gomi.md.bak")).toBe(false);
  });

  it("dotfile は除外する。ディレクトリ名の . は見ない", () => {
    expect(isUploadableMarkdown(".DS_Store")).toBe(false);
    expect(isUploadableMarkdown("kurashi/.hidden.md")).toBe(false);
    expect(isUploadableMarkdown(".obsidian/note.md")).toBe(true);
  });
});

describe("pickedFilesToCandidates", () => {
  const picked = (name: string, webkitRelativePath = "") => {
    const f = new File(["x"], name);
    Object.defineProperty(f, "webkitRelativePath", {
      value: webkitRelativePath,
    });
    return f;
  };

  it("フォルダ選択では選んだフォルダを root として先頭のフォルダ名を落とし、ファイル選択ではファイル名を使う", () => {
    const result = pickedFilesToCandidates([
      picked("gomi.md", "knowledge/kurashi/gomi.md"),
      picked("index.md", "knowledge/index.md"),
      picked("top.md"),
    ]);
    expect(result.map((c) => c.relativePath)).toEqual([
      "kurashi/gomi.md",
      "index.md",
      "top.md",
    ]);
  });

  it(".md 以外と dotfile は落とす", () => {
    const result = pickedFilesToCandidates([
      picked("memo.txt"),
      picked(".DS_Store", "kurashi/.DS_Store"),
      picked("ok.md"),
    ]);
    expect(result.map((c) => c.relativePath)).toEqual(["ok.md"]);
  });
});

describe("readAllEntries", () => {
  const entry = (name: string) => ({ name }) as unknown as FileSystemEntry;

  it("空配列が返るまで readEntries を繰り返して結合する", async () => {
    const batches = [[entry("a"), entry("b")], [entry("c")], []];
    const readEntries = vi.fn(
      (resolve: (entries: FileSystemEntry[]) => void) => {
        resolve(batches.shift() ?? []);
      },
    );

    const result = await readAllEntries({ readEntries });

    expect(result.map((e) => e.name)).toEqual(["a", "b", "c"]);
    expect(readEntries).toHaveBeenCalledTimes(3);
  });

  it("読み取りエラーは reject する", async () => {
    const readEntries = (
      _resolve: (entries: FileSystemEntry[]) => void,
      reject?: (error: DOMException) => void,
    ) => reject?.(new DOMException("denied"));

    await expect(readAllEntries({ readEntries })).rejects.toThrow("denied");
  });
});

describe("collectMarkdownFiles", () => {
  type Node =
    | { kind: "file"; fullPath: string }
    | { kind: "dir"; fullPath: string; children: Node[] };

  const toEntry = (node: Node) =>
    ({
      isFile: node.kind === "file",
      isDirectory: node.kind === "dir",
      fullPath: node.fullPath,
      name: node.fullPath.split("/").pop(),
      children: node.kind === "dir" ? node.children : undefined,
    }) as unknown as FileSystemEntry;

  const deps = {
    readDirectory: vi.fn(async (dir: FileSystemDirectoryEntry) =>
      ((dir as unknown as { children: Node[] }).children ?? []).map(toEntry),
    ),
    readFile: vi.fn(
      async (entry: FileSystemFileEntry) =>
        new File([entry.fullPath], entry.name),
    ),
  };

  it("ドロップしたフォルダを root として再帰的に走査し、.md だけをフォルダからの相対パスで返す", async () => {
    const tree: Node[] = [
      { fullPath: "/single.md", kind: "file" },
      {
        fullPath: "/knowledge",
        kind: "dir",
        children: [
          { fullPath: "/knowledge/top.md", kind: "file" },
          { fullPath: "/knowledge/readme.txt", kind: "file" },
          {
            fullPath: "/knowledge/kurashi",
            kind: "dir",
            children: [
              { fullPath: "/knowledge/kurashi/gomi.md", kind: "file" },
              { fullPath: "/knowledge/kurashi/.DS_Store", kind: "file" },
              {
                fullPath: "/knowledge/kurashi/deep",
                kind: "dir",
                children: [
                  {
                    fullPath: "/knowledge/kurashi/deep/suido.md",
                    kind: "file",
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const result = await collectMarkdownFiles(tree.map(toEntry), deps);

    expect(result.map((c) => c.relativePath)).toEqual([
      "single.md",
      "top.md",
      "kurashi/gomi.md",
      "kurashi/deep/suido.md",
    ]);
    expect(result.map((c) => c.file.name)).toEqual([
      "single.md",
      "top.md",
      "gomi.md",
      "suido.md",
    ]);
    expect(deps.readFile).toHaveBeenCalledTimes(4);
  });

  it("空のディレクトリは何も返さない", async () => {
    const result = await collectMarkdownFiles(
      [toEntry({ fullPath: "/empty", kind: "dir", children: [] })],
      deps,
    );
    expect(result).toEqual([]);
  });
});

describe("runWithConcurrency", () => {
  it("同時実行数を上限に抑えつつ、結果を元の順序で返す", async () => {
    let running = 0;
    let peak = 0;
    const tasks = [5, 1, 3, 2, 4].map((n) => async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, n));
      running -= 1;
      return n;
    });

    const results = await runWithConcurrency(tasks, 2);

    expect(results).toEqual([5, 1, 3, 2, 4]);
    expect(peak).toBe(2);
  });

  it("タスクが空なら空配列", async () => {
    expect(await runWithConcurrency([], 3)).toEqual([]);
  });

  it("1 つが reject したら全体が reject する", async () => {
    await expect(
      runWithConcurrency(
        [async () => 1, async () => Promise.reject(new Error("x"))],
        3,
      ),
    ).rejects.toThrow("x");
  });
});
