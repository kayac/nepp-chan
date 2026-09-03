import matter from "gray-matter";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateMock, recordLlmUsageMock, convertToMarkdownMock } = vi.hoisted(
  () => ({
    generateMock: vi.fn(),
    recordLlmUsageMock: vi.fn(),
    convertToMarkdownMock: vi.fn(),
  }),
);

vi.mock("~/mastra/agents/curated-drafter-agent", () => ({
  curatedDrafterAgent: { generate: generateMock },
}));

vi.mock("~/services/analytics/llm-usage", () => ({
  recordLlmUsage: recordLlmUsageMock,
}));

vi.mock("~/lib/image-converter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/image-converter")>()),
  convertToMarkdown: convertToMarkdownMock,
}));

const {
  buildCuratedMarkdown,
  CuratedDraftError,
  draftCurated,
  normalizeUrl,
  toSlug,
} = await import("./curated-draft");

const fetchSpy = vi.spyOn(globalThis, "fetch");

const htmlResponse = (body: string, init?: ResponseInit & { url?: string }) => {
  const response = new Response(body, {
    status: init?.status ?? 200,
    headers: { "content-type": "text/html; charset=utf-8", ...init?.headers },
  });
  if (init?.url) Object.defineProperty(response, "url", { value: init.url });
  return response;
};

const draftFields = {
  title: "音威子府TOKYO（東京の音威子府そばの店）",
  category: "お店・スポット",
  slug: "otoineppu-tokyo",
  notice: "営業時間等は公式サイトで確認してください。",
  summary: "東京都新宿区にある蕎麦店。\n\n黒い蕎麦を提供する。",
  sourceLinks: [] as { label: string; url: string }[],
};

const respondWithDraft = (overrides: Partial<typeof draftFields> = {}) => {
  generateMock.mockResolvedValue({
    object: { ...draftFields, ...overrides },
    totalUsage: { inputTokens: 10, outputTokens: 5 },
    response: { modelId: "openai/gpt-5.6-luna" },
  });
};

beforeEach(() => {
  fetchSpy.mockReset();
  generateMock.mockReset();
  recordLlmUsageMock.mockReset();
  convertToMarkdownMock.mockReset();
});

describe("normalizeUrl", () => {
  it("www・末尾スラッシュ・utm・fragment を無視して同一視する", () => {
    expect(normalizeUrl("https://www.example.com/shop/?utm_source=x#top")).toBe(
      normalizeUrl("http://example.com/shop"),
    );
  });

  it("パスやクエリが違えば別 URL", () => {
    expect(normalizeUrl("https://example.com/a")).not.toBe(
      normalizeUrl("https://example.com/b"),
    );
    expect(normalizeUrl("https://example.com/a?p=1")).not.toBe(
      normalizeUrl("https://example.com/a?p=2"),
    );
  });
});

describe("toSlug", () => {
  it("英小文字とハイフンに正規化する", () => {
    expect(toSlug("  Otoineppu TOKYO_shop!! ")).toBe("otoineppu-tokyo-shop");
  });

  it("60 文字で切っても末尾にハイフンを残さない", () => {
    expect(toSlug(`${"a".repeat(59)}-bbb`)).toBe("a".repeat(59));
  });

  it("空になったら URL の hostname を使う", () => {
    expect(toSlug("音威子府", "https://www.peraichi.com/x")).toBe(
      "peraichi-com",
    );
  });

  it("URL も無ければ JST の日時から作る", () => {
    expect(toSlug("", undefined, new Date("2026-09-02T15:04:00Z"))).toBe(
      "curated-20260903-0004",
    );
  });
});

describe("buildCuratedMarkdown", () => {
  const verifiedAt = "2026-09-02";

  it("#1083 と同じ frontmatter と本文構成を出す", () => {
    const md = buildCuratedMarkdown(draftFields, {
      inputUrls: ["https://peraichi.com/landing_pages/view/otoineppu"],
      verifiedAt,
    });
    const parsed = matter(md);

    expect(parsed.data).toEqual({
      title: draftFields.title,
      category: "お店・スポット",
      source_type: "curated",
      source_authority: 2,
      verified_at: "2026-09-02",
      url: "https://peraichi.com/landing_pages/view/otoineppu",
    });
    expect(parsed.content.trim()).toBe(
      [
        "# 音威子府TOKYO（東京の音威子府そばの店）",
        "",
        "> 営業時間等は公式サイトで確認してください。",
        "",
        "東京都新宿区にある蕎麦店。",
        "",
        "黒い蕎麦を提供する。",
        "",
        "## 情報源",
        "",
        "- https://peraichi.com/landing_pages/view/otoineppu",
      ].join("\n"),
    );
  });

  it("verified_at と url は YAML で文字列として quote される", () => {
    const md = buildCuratedMarkdown(draftFields, {
      inputUrls: ["https://example.com/"],
      verifiedAt,
    });

    expect(md).toContain("verified_at: '2026-09-02'");
    expect(md).toContain("url: 'https://example.com/'");
  });

  it("入力 URL は読めなくても全部載せ、sourceLinks は重複を除いてラベル付きで続ける", () => {
    const md = buildCuratedMarkdown(
      {
        ...draftFields,
        sourceLinks: [
          { label: "公式サイト", url: "https://www.peraichi.com/x/" },
          { label: "紹介記事", url: "https://news.example.com/a" },
        ],
      },
      {
        inputUrls: [
          "https://peraichi.com/x",
          "https://www.instagram.com/usagi/",
        ],
        verifiedAt,
      },
    );

    expect(matter(md).content).toContain(
      [
        "## 情報源",
        "",
        "- 公式サイト: https://peraichi.com/x",
        "- https://www.instagram.com/usagi/",
        "- 紹介記事: https://news.example.com/a",
      ].join("\n"),
    );
  });

  it("入力 URL が無ければ frontmatter に url を出さず、情報源が空なら見出しも出さない", () => {
    const md = buildCuratedMarkdown(draftFields, { inputUrls: [], verifiedAt });

    expect(matter(md).data).not.toHaveProperty("url");
    expect(md).not.toContain("## 情報源");
  });
});

describe("draftCurated", () => {
  const deps = {};

  it("URL を fetch して本文を LLM に渡し、curated/ 配下の key と Markdown を返す", async () => {
    fetchSpy.mockResolvedValue(
      htmlResponse(
        "<html><head><title>店</title></head><body><p>本文です</p></body></html>",
      ),
    );
    respondWithDraft();

    const result = await draftCurated(
      { urls: ["https://example.com/shop"], files: [] },
      deps,
    );

    expect(result.key).toBe("curated/otoineppu-tokyo.md");
    expect(result.readUrls).toEqual(["https://example.com/shop"]);
    expect(result.unreadable).toEqual([]);
    expect(matter(result.content).data.url).toBe("https://example.com/shop");
    const prompt = generateMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("## 資料 1（URL: https://example.com/shop）");
    expect(prompt).toContain("店\n本文です");
    expect(generateMock.mock.calls[0]?.[1]).toMatchObject({
      structuredOutput: { schema: expect.anything() },
    });
  });

  it("複数 URL のうち 1 つが 404 でも残りで下書きを作り、unreadable に載せる", async () => {
    fetchSpy
      .mockResolvedValueOnce(htmlResponse("<p>読める</p>"))
      .mockResolvedValueOnce(htmlResponse("", { status: 404 }));
    respondWithDraft();

    const result = await draftCurated(
      { urls: ["https://a.example/", "https://b.example/"], files: [] },
      deps,
    );

    expect(result.readUrls).toEqual(["https://a.example/"]);
    expect(result.unreadable).toEqual([
      { name: "https://b.example/", reason: "HTTP 404" },
    ]);
    expect(matter(result.content).content).toContain("- https://b.example/");
  });

  it("ログインページに転送された URL は資料に混ぜない", async () => {
    fetchSpy.mockResolvedValue(
      htmlResponse("<p>ログイン アカウント登録</p>", {
        url: "https://www.instagram.com/accounts/login/?next=%2Fusagi%2F",
      }),
    );

    await expect(
      draftCurated(
        { urls: ["https://www.instagram.com/usagi/"], files: [] },
        deps,
      ),
    ).rejects.toBeInstanceOf(CuratedDraftError);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("別ホストへの転送でもログインページでなければ読む", async () => {
    fetchSpy.mockResolvedValue(
      htmlResponse("<p>本文</p>", { url: "https://shop.example.net/about" }),
    );
    respondWithDraft();

    const result = await draftCurated(
      { urls: ["https://example.com/shop"], files: [] },
      deps,
    );

    expect(result.readUrls).toEqual(["https://example.com/shop"]);
  });

  it("形式が URL でないものは fetch せず unreadable にする", async () => {
    respondWithDraft();

    const result = await draftCurated(
      { urls: ["ftp://example.com/x", "not a url"], text: "本文", files: [] },
      deps,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.unreadable.map((u) => u.name)).toEqual([
      "ftp://example.com/x",
      "not a url",
    ]);
    expect(matter(result.content).data).not.toHaveProperty("url");
  });

  it("全部読めなければ no_content で失敗し、読めなかった理由を持つ", async () => {
    fetchSpy.mockResolvedValue(htmlResponse("", { status: 500 }));

    await expect(
      draftCurated({ urls: ["https://a.example/"], files: [] }, deps),
    ).rejects.toMatchObject({
      unreadable: [{ name: "https://a.example/", reason: "HTTP 500" }],
    });
  });

  it("readUrls は完了順ではなく入力順で返す", async () => {
    fetchSpy.mockImplementation(async (url) => {
      if (String(url).includes("slow")) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return htmlResponse("<p>本文</p>");
    });
    respondWithDraft();

    const result = await draftCurated(
      { urls: ["https://slow.example/", "https://fast.example/"], files: [] },
      deps,
    );

    expect(result.readUrls).toEqual([
      "https://slow.example/",
      "https://fast.example/",
    ]);
  });

  it("資料が多いときはプロンプト枠を資料ごとに等分し、後ろの資料も落とさない", async () => {
    fetchSpy.mockImplementation(async () =>
      htmlResponse(`<p>${"あ".repeat(30_000)}</p>`),
    );
    respondWithDraft();

    await draftCurated(
      {
        urls: [
          "https://a.example/",
          "https://b.example/",
          "https://c.example/",
        ],
        text: "職員の補足",
        files: [],
      },
      deps,
    );

    const prompt = generateMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("## 資料 4（入力済みのテキスト）\n\n職員の補足");
    expect(prompt.length).toBeLessThanOrEqual(60_000 + 4 * 100);
  });

  it("資料の本文は 30,000 文字で切って LLM に渡す", async () => {
    fetchSpy.mockResolvedValue(htmlResponse(`<p>${"あ".repeat(40_000)}</p>`));
    respondWithDraft();

    await draftCurated({ urls: ["https://a.example/"], files: [] }, deps);

    const prompt = generateMock.mock.calls[0]?.[0] as string;
    expect(prompt.match(/あ/g)).toHaveLength(30_000);
  });

  it("本文が短くても資料として通す", async () => {
    fetchSpy.mockResolvedValue(htmlResponse("<p>開店準備中</p>"));
    respondWithDraft();

    const result = await draftCurated(
      { urls: ["https://a.example/"], files: [] },
      deps,
    );

    expect(result.readUrls).toEqual(["https://a.example/"]);
  });

  it("X の投稿 URL は oEmbed で読む", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          author_name: "shop",
          html: "<blockquote><p>本日開店</p></blockquote>",
        }),
        { status: 200 },
      ),
    );
    respondWithDraft();

    await draftCurated(
      { urls: ["https://x.com/shop/status/123"], files: [] },
      deps,
    );

    expect(fetchSpy.mock.calls[0]?.[0]).toContain("publish.x.com/oembed");
    const prompt = generateMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("X の投稿 @shop");
    expect(prompt).toContain("本日開店");
  });

  it("URL 先が PDF や画像なら convertToMarkdown に渡す", async () => {
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );
    convertToMarkdownMock.mockResolvedValue("# PDF の内容");
    respondWithDraft();

    await draftCurated({ urls: ["https://a.example/f.pdf"], files: [] }, deps);

    expect(convertToMarkdownMock).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      "application/pdf",
      undefined,
    );
    expect(generateMock.mock.calls[0]?.[0]).toContain("# PDF の内容");
  });

  it("Content-Length が 5MB を超える URL は本文を読まずに unreadable にする", async () => {
    fetchSpy.mockResolvedValue(
      htmlResponse("<p>小さい本文</p>", {
        headers: { "content-length": String(6 * 1024 * 1024) },
      }),
    );
    respondWithDraft();

    const result = await draftCurated(
      { urls: ["https://a.example/huge"], text: "本文", files: [] },
      deps,
    );

    expect(result.unreadable).toEqual([
      { name: "https://a.example/huge", reason: "5MB を超えています" },
    ]);
  });

  it("Content-Length が無くても本文が 5MB を超えたら読み捨てて unreadable にする", async () => {
    const big = new Uint8Array(6 * 1024 * 1024);
    fetchSpy.mockResolvedValue(
      new Response(big, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    respondWithDraft();

    const result = await draftCurated(
      { urls: ["https://a.example/huge"], text: "本文", files: [] },
      deps,
    );

    expect(result.unreadable).toEqual([
      { name: "https://a.example/huge", reason: "5MB を超えています" },
    ]);
  });

  it("unreadable は完了順ではなく入力順で並ぶ", async () => {
    fetchSpy.mockImplementation(async (url) => {
      if (String(url).includes("slow")) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return htmlResponse("", { status: 404 });
    });
    respondWithDraft();

    const result = await draftCurated(
      {
        urls: ["https://slow.example/", "https://fast.example/"],
        text: "本文",
        files: [],
      },
      deps,
    );

    expect(result.unreadable.map((u) => u.name)).toEqual([
      "https://slow.example/",
      "https://fast.example/",
    ]);
  });

  it("1 件目の URL が読めなくても frontmatter の url は入力 1 件目のまま", async () => {
    fetchSpy
      .mockResolvedValueOnce(htmlResponse("", { status: 404 }))
      .mockResolvedValueOnce(htmlResponse("<p>読める</p>"));
    respondWithDraft();

    const result = await draftCurated(
      {
        urls: ["https://www.instagram.com/usagi/", "https://b.example/"],
        files: [],
      },
      deps,
    );

    expect(matter(result.content).data.url).toBe(
      "https://www.instagram.com/usagi/",
    );
    expect(result.readUrls).toEqual(["https://b.example/"]);
  });

  it("未対応の Content-Type は unreadable にする", async () => {
    fetchSpy.mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    respondWithDraft();

    const result = await draftCurated(
      { urls: ["https://a.example/api"], text: "本文", files: [] },
      deps,
    );

    expect(result.unreadable[0]?.reason).toContain("未対応の形式");
  });

  it("アップロードされた画像は convertToMarkdown に渡し、ラベルにファイル名を付ける", async () => {
    convertToMarkdownMock.mockResolvedValue("チラシの文字");
    respondWithDraft();
    const file = new File(["img"], "flyer.png", { type: "image/png" });

    const result = await draftCurated({ urls: [], files: [file] }, deps);

    expect(convertToMarkdownMock).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      "image/png",
      undefined,
    );
    const prompt = generateMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("画像・PDF: flyer.png");
    expect(matter(result.content).data).not.toHaveProperty("url");
  });

  it("入力済みのテキストは最後の資料として渡す", async () => {
    fetchSpy.mockResolvedValue(htmlResponse("<p>ページ</p>"));
    respondWithDraft();

    await draftCurated(
      { urls: ["https://a.example/"], text: "  補足メモ  ", files: [] },
      deps,
    );

    const prompt = generateMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("## 資料 2（入力済みのテキスト）\n\n補足メモ");
  });

  it("d1 があれば curated-draft として usage を記録する", async () => {
    respondWithDraft();
    const d1 = {} as D1Database;

    await draftCurated({ urls: [], text: "本文", files: [] }, { ...deps, d1 });

    expect(recordLlmUsageMock).toHaveBeenCalledWith(d1, {
      model: "openai/gpt-5.6-luna",
      usage: { inputTokens: 10, outputTokens: 5 },
      source: "curated-draft",
      agent: "curated-drafter",
    });
  });

  it("slug が使えなければ入力 URL の hostname から key を作る", async () => {
    fetchSpy.mockResolvedValue(htmlResponse("<p>本文</p>"));
    respondWithDraft({ slug: "店" });

    const result = await draftCurated(
      { urls: ["https://www.peraichi.com/x"], files: [] },
      deps,
    );

    expect(result.key).toBe("curated/peraichi-com.md");
  });
});
