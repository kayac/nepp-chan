import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireApiKey, validateFileKey } from "./schemas";

vi.mock("~/services/knowledge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/services/knowledge")>()),
  listFiles: vi.fn(),
  getFile: vi.fn(),
  getOriginalFile: vi.fn(),
  listUnifiedFiles: vi.fn(),
  deleteFile: vi.fn(),
  syncFile: vi.fn(),
  deleteAllKnowledge: vi.fn(),
  syncAll: vi.fn(),
  uploadMarkdownFile: vi.fn(),
  convertAndUpload: vi.fn(),
  reconvertFromOriginal: vi.fn(),
  draftCurated: vi.fn(),
}));

vi.mock("~/repository/admin-session-repository", () => ({
  adminSessionRepository: {
    findValid: vi.fn(),
  },
}));

vi.mock("~/repository/admin-user-repository", () => ({
  adminUserRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("~/services/auth/anonymous-session", () => ({
  verifyAnonymousToken: vi.fn(),
}));

const knowledgeService = await import("~/services/knowledge");
const { adminSessionRepository } = await import(
  "~/repository/admin-session-repository"
);
const { adminUserRepository } = await import(
  "~/repository/admin-user-repository"
);
const { knowledgeAdminRoutes } = await import(".");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const app = await withResolvePrincipal(knowledgeAdminRoutes);

const testUser = {
  id: "user-1",
  username: "admin01",
  name: "管理者",
  role: "super_admin",
  passwordHash: "100000:salt:hash",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: null,
};

const mockEnv = {
  DB: {} as D1Database,
  KNOWLEDGE_BUCKET: {
    put: vi.fn(),
  } as unknown as R2Bucket,
  VECTORIZE: {} as VectorizeIndex,
  GOOGLE_GENERATIVE_AI_API_KEY: "test-api-key",
  JWT_SECRET: "test-secret-32-chars-long-enough",
} as unknown as CloudflareBindings;

const VALID_OPAQUE_TOKEN = "a".repeat(64);

const authedRequest = (path: string, init?: RequestInit) => {
  const req = new Request(`http://localhost${path}`, init);
  req.headers.set("Authorization", `Bearer ${VALID_OPAQUE_TOKEN}`);
  return req;
};

describe("knowledge schemas ユーティリティ", () => {
  describe("validateFileKey", () => {
    it("正常なキーでは例外を投げない", () => {
      expect(() => validateFileKey("test.md")).not.toThrow();
      expect(() => validateFileKey("dir/file.md")).not.toThrow();
    });

    it(".. を含むキーで HTTPException を投げる", () => {
      expect(() => validateFileKey("../etc/passwd")).toThrow(HTTPException);
    });

    it("/ で始まるキーで HTTPException を投げる", () => {
      expect(() => validateFileKey("/etc/passwd")).toThrow(HTTPException);
    });
  });

  describe("requireApiKey", () => {
    it("API キーがある場合はそのまま返す", () => {
      expect(requireApiKey("test-key")).toBe("test-key");
    });

    it("undefined の場合は HTTPException を投げる", () => {
      expect(() => requireApiKey(undefined)).toThrow(HTTPException);
    });
  });
});

describe("knowledge routes 統合テスト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
      token: VALID_OPAQUE_TOKEN,
      userId: "user-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: "2024-01-01T00:00:00Z",
    });
    vi.mocked(adminUserRepository.findById).mockResolvedValue(testUser);
  });

  describe("認証", () => {
    it.each([
      { method: "GET", path: "/files" },
      { method: "GET", path: "/files/test.md" },
      { method: "PUT", path: "/files/test.md" },
      { method: "DELETE", path: "/files/test.md" },
      { method: "GET", path: "/unified" },
      { method: "GET", path: "/originals/test.pdf" },
      { method: "DELETE", path: "/" },
      { method: "POST", path: "/sync" },
      { method: "POST", path: "/upload" },
      { method: "POST", path: "/convert" },
      { method: "POST", path: "/reconvert" },
      { method: "POST", path: "/curated-draft" },
    ])("$method $path - 認証なしは 401", async ({ method, path }) => {
      const res = await app.request(
        new Request(`http://localhost${path}`, { method }),
        undefined,
        mockEnv,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /files", () => {
    it("ファイル一覧を返す", async () => {
      const mockFiles = {
        files: [
          {
            key: "test.md",
            size: 100,
            lastModified: "2024-01-01",
            etag: "abc",
          },
        ],
        truncated: false,
      };
      vi.mocked(knowledgeService.listFiles).mockResolvedValue(mockFiles);

      const res = await app.request(
        authedRequest("/files"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(mockFiles);
    });
  });

  describe("GET /files/:key", () => {
    it("ファイル内容を返す", async () => {
      const mockFile = {
        key: "test.md",
        content: "# Test",
        contentType: "text/markdown",
        size: 6,
        lastModified: "2024-01-01",
      };
      vi.mocked(knowledgeService.getFile).mockResolvedValue(mockFile);

      const res = await app.request(
        authedRequest("/files/test.md"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(mockFile);
    });

    it("ファイルが見つからない場合は 404 を返す", async () => {
      vi.mocked(knowledgeService.getFile).mockResolvedValue(null);

      const res = await app.request(
        authedRequest("/files/notfound.md"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /files/:key", () => {
    it("ファイルを削除する", async () => {
      vi.mocked(knowledgeService.deleteFile).mockResolvedValue();

      const res = await app.request(
        authedRequest("/files/test.md", { method: "DELETE" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(knowledgeService.deleteFile).toHaveBeenCalled();
    });
  });

  describe("DELETE /", () => {
    it("全ナレッジを削除する", async () => {
      vi.mocked(knowledgeService.deleteAllKnowledge).mockResolvedValue({
        deleted: 5,
      });

      const res = await app.request(
        authedRequest("/", { method: "DELETE" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { count: number };
      expect(body.count).toBe(5);
    });
  });

  describe("POST /sync", () => {
    it("全ナレッジを同期する", async () => {
      vi.mocked(knowledgeService.syncAll).mockResolvedValue({
        totalFiles: 2,
        totalChunks: 10,
        results: [
          { file: "a.md", chunks: 5 },
          { file: "b.md", chunks: 5 },
        ],
        editedCount: 0,
      });

      const res = await app.request(
        authedRequest("/sync", { method: "POST" }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: unknown[] };
      expect(body.results).toHaveLength(2);
    });
  });

  describe("GET /unified", () => {
    it("統合ファイル一覧を返す", async () => {
      const mockFiles = {
        files: [{ baseName: "test", hasMarkdown: true }],
        truncated: false,
      };
      vi.mocked(knowledgeService.listUnifiedFiles).mockResolvedValue(mockFiles);

      const res = await app.request(
        authedRequest("/unified"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(mockFiles);
    });
  });

  describe("GET /originals/:key", () => {
    it("元ファイルが見つからない場合は 404 を返す", async () => {
      vi.mocked(knowledgeService.getOriginalFile).mockResolvedValue(null);

      const res = await app.request(
        authedRequest("/originals/notfound.pdf"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });

    it("正常系: body と Content-Type を返す", async () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      vi.mocked(knowledgeService.getOriginalFile).mockResolvedValue({
        body: bytes.buffer,
        contentType: "application/pdf",
        size: 8,
      });

      const res = await app.request(
        authedRequest("/originals/doc.pdf"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Length")).toBe("8");
      const returned = new Uint8Array(await res.arrayBuffer());
      expect(Array.from(returned)).toEqual(Array.from(bytes));
    });
  });

  describe("PUT /files/:key", () => {
    const jsonBody = (data: Record<string, unknown>): RequestInit => ({
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    it("API キー未設定なら 500", async () => {
      const res = await app.request(
        authedRequest("/files/doc.md", jsonBody({ content: "x" })),
        undefined,
        {
          ...mockEnv,
          GOOGLE_GENERATIVE_AI_API_KEY: undefined,
        } as never,
      );
      expect(res.status).toBe(500);
    });

    it("正常系: bucket.put → syncFile → 200", async () => {
      vi.mocked(knowledgeService.syncFile).mockResolvedValue({ chunks: 4 });

      const res = await app.request(
        authedRequest("/files/doc.md", jsonBody({ content: "# c" })),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockEnv.KNOWLEDGE_BUCKET.put).toHaveBeenCalledWith(
        "doc.md",
        "# c",
        { httpMetadata: { contentType: "text/markdown" } },
      );
      expect(knowledgeService.syncFile).toHaveBeenCalledWith(
        "doc.md",
        "# c",
        expect.objectContaining({ apiKey: "test-api-key" }),
      );
      const body = (await res.json()) as { chunks: number };
      expect(body.chunks).toBe(4);
    });
  });

  describe("POST /upload", () => {
    const buildForm = (
      file: File | string | null,
      filename?: string | null,
    ) => {
      const form = new FormData();
      if (file !== null) form.append("file", file);
      if (filename !== undefined && filename !== null)
        form.append("filename", filename);
      return form;
    };

    it("File でない値は 400", async () => {
      const res = await app.request(
        authedRequest("/upload", {
          method: "POST",
          body: buildForm("not-a-file"),
        }),
        undefined,
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it("customFilename が不正なら 400", async () => {
      const file = new File(["# c"], "doc.md", { type: "text/markdown" });
      const res = await app.request(
        authedRequest("/upload", {
          method: "POST",
          body: buildForm(file, "../etc/passwd"),
        }),
        undefined,
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it("API キー未設定なら 500", async () => {
      const file = new File(["# c"], "doc.md", { type: "text/markdown" });
      const res = await app.request(
        authedRequest("/upload", {
          method: "POST",
          body: buildForm(file),
        }),
        undefined,
        { ...mockEnv, GOOGLE_GENERATIVE_AI_API_KEY: undefined } as never,
      );
      expect(res.status).toBe(500);
    });

    it("正常系: uploadMarkdownFile を呼び 200 を返す", async () => {
      vi.mocked(knowledgeService.uploadMarkdownFile).mockResolvedValue({
        key: "doc.md",
        chunks: 4,
      });
      const file = new File(["# c"], "doc.md", { type: "text/markdown" });

      const res = await app.request(
        authedRequest("/upload", {
          method: "POST",
          body: buildForm(file, "doc.md"),
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { key: string; chunks: number };
      expect(body.key).toBe("doc.md");
      expect(body.chunks).toBe(4);
      expect(knowledgeService.uploadMarkdownFile).toHaveBeenCalledWith(
        expect.any(File),
        "doc.md",
        expect.objectContaining({ apiKey: "test-api-key" }),
      );
    });

    it("filename 省略時は null を渡す", async () => {
      vi.mocked(knowledgeService.uploadMarkdownFile).mockResolvedValue({
        key: "x.md",
        chunks: 1,
      });
      const file = new File(["# c"], "x.md", { type: "text/markdown" });

      await app.request(
        authedRequest("/upload", {
          method: "POST",
          body: buildForm(file),
        }),
        undefined,
        mockEnv,
      );

      expect(knowledgeService.uploadMarkdownFile).toHaveBeenCalledWith(
        expect.any(File),
        null,
        expect.any(Object),
      );
    });
  });

  describe("POST /convert", () => {
    const buildForm = (file: File | string | null, filename: string | null) => {
      const form = new FormData();
      if (file !== null) form.append("file", file);
      if (filename !== null) form.append("filename", filename);
      return form;
    };

    it("File でない値は 400", async () => {
      const res = await app.request(
        authedRequest("/convert", {
          method: "POST",
          body: buildForm("not-a-file", "out.md"),
        }),
        undefined,
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it("filename 未指定は 400", async () => {
      const file = new File(["x"], "in.png", { type: "image/png" });
      const res = await app.request(
        authedRequest("/convert", {
          method: "POST",
          body: buildForm(file, null),
        }),
        undefined,
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it("filename が不正なら 400", async () => {
      const file = new File(["x"], "in.png", { type: "image/png" });
      const res = await app.request(
        authedRequest("/convert", {
          method: "POST",
          body: buildForm(file, "../bad"),
        }),
        undefined,
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it("正常系: convertAndUpload を呼び 200 を返す", async () => {
      vi.mocked(knowledgeService.convertAndUpload).mockResolvedValue({
        key: "out.md",
        originalType: "image/png",
        chunks: 3,
      });
      const file = new File(["x"], "in.png", { type: "image/png" });

      const res = await app.request(
        authedRequest("/convert", {
          method: "POST",
          body: buildForm(file, "out"),
        }),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        key: string;
        originalType: string;
        chunks: number;
      };
      expect(body).toMatchObject({
        key: "out.md",
        originalType: "image/png",
        chunks: 3,
      });
    });
  });

  describe("POST /reconvert", () => {
    const jsonBody = (data: Record<string, unknown>): RequestInit => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    it("originalKey が originals/ で始まらないと 400", async () => {
      const res = await app.request(
        authedRequest(
          "/reconvert",
          jsonBody({ originalKey: "other/x.pdf", filename: "out" }),
        ),
        undefined,
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it("filename が不正なら 400", async () => {
      const res = await app.request(
        authedRequest(
          "/reconvert",
          jsonBody({
            originalKey: "originals/x.pdf",
            filename: "/etc/passwd",
          }),
        ),
        undefined,
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it("正常系: reconvertFromOriginal を呼び 200 を返す", async () => {
      vi.mocked(knowledgeService.reconvertFromOriginal).mockResolvedValue({
        key: "out.md",
        originalType: "application/pdf",
        chunks: 7,
      });

      const res = await app.request(
        authedRequest(
          "/reconvert",
          jsonBody({ originalKey: "originals/x.pdf", filename: "out" }),
        ),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { key: string; chunks: number };
      expect(body.key).toBe("out.md");
      expect(body.chunks).toBe(7);
      expect(knowledgeService.reconvertFromOriginal).toHaveBeenCalledWith(
        "originals/x.pdf",
        "out",
        expect.any(Object),
      );
    });
  });
});

describe("POST /curated-draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminSessionRepository.findValid).mockResolvedValue({
      token: VALID_OPAQUE_TOKEN,
      userId: "user-1",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: "2024-01-01T00:00:00Z",
    });
    vi.mocked(adminUserRepository.findById).mockResolvedValue(testUser);
  });

  const draftEnv = mockEnv;

  const post = (form: FormData) =>
    app.request(
      authedRequest("/curated-draft", { method: "POST", body: form }),
      undefined,
      draftEnv,
    );

  const draft = {
    key: "curated/otoineppu-tokyo.md",
    content: "---\ntitle: x\n---\n# x\n",
    readUrls: ["https://a.example/"],
    unreadable: [],
  };

  it("urls・text・files を配列に正規化してサービスに渡す", async () => {
    vi.mocked(knowledgeService.draftCurated).mockResolvedValue(draft);
    const form = new FormData();
    form.append("urls", " https://a.example/ ");
    form.append("urls", "https://b.example/");
    form.append("text", " 補足 ");
    form.append("files", new File(["x"], "f.png", { type: "image/png" }));

    const res = await post(form);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(draft);
    const [input, deps] = vi.mocked(knowledgeService.draftCurated).mock
      .calls[0] as [
      Parameters<typeof knowledgeService.draftCurated>[0],
      Parameters<typeof knowledgeService.draftCurated>[1],
    ];
    expect(input.urls).toEqual(["https://a.example/", "https://b.example/"]);
    expect(input.text).toBe("補足");
    expect(input.files.map((f) => f.name)).toEqual(["f.png"]);
    expect(deps).toEqual({ d1: draftEnv.DB });
  });

  it("URL が 1 件だけでも配列として渡す", async () => {
    vi.mocked(knowledgeService.draftCurated).mockResolvedValue(draft);
    const form = new FormData();
    form.append("urls", "https://a.example/");

    await post(form);

    const input = vi.mocked(knowledgeService.draftCurated).mock.calls[0]?.[0];
    expect(input?.urls).toEqual(["https://a.example/"]);
    expect(input?.files).toEqual([]);
  });

  it("全部空なら 400", async () => {
    const form = new FormData();
    form.append("urls", "   ");
    form.append("text", "");

    const res = await post(form);

    expect(res.status).toBe(400);
    expect(knowledgeService.draftCurated).not.toHaveBeenCalled();
  });

  it("未対応のファイル形式は 400", async () => {
    const form = new FormData();
    form.append("files", new File(["x"], "memo.txt", { type: "text/plain" }));

    const res = await post(form);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("memo.txt");
  });

  it("URL が 11 件以上なら 400", async () => {
    const form = new FormData();
    for (let i = 0; i < 11; i++) form.append("urls", `https://a.example/${i}`);

    const res = await post(form);

    expect(res.status).toBe(400);
  });

  it("どの資料も読めなければ 422 と案内文", async () => {
    const { CuratedDraftError } = await vi.importActual<
      typeof import("~/services/knowledge/curated-draft")
    >("~/services/knowledge/curated-draft");
    vi.mocked(knowledgeService.draftCurated).mockRejectedValue(
      new CuratedDraftError([
        { name: "https://www.instagram.com/usagi/", reason: "HTTP 429" },
      ]),
    );
    const form = new FormData();
    form.append("urls", "https://www.instagram.com/usagi/");

    const res = await post(form);

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("個別投稿の URL");
    expect(body.error.message).toContain(
      "https://www.instagram.com/usagi/（HTTP 429）",
    );
  });

  it("想定外のエラーは 500", async () => {
    vi.mocked(knowledgeService.draftCurated).mockRejectedValue(
      new Error("boom"),
    );
    const form = new FormData();
    form.append("text", "本文");

    const res = await post(form);

    expect(res.status).toBe(500);
  });
});
