import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  requireApiKey,
  validateFileKey,
} from "~/routes/admin/knowledge/schemas";

// services/knowledge と session のモック
vi.mock("~/services/knowledge", () => ({
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
}));

vi.mock("~/services/auth/session", () => ({
  getUserFromSession: vi.fn(),
}));

const knowledgeService = await import("~/services/knowledge");
const sessionService = await import("~/services/auth/session");
const { knowledgeAdminRoutes } = await import("~/routes/admin/knowledge");

const testUser = {
  id: "user-1",
  email: "admin@example.com",
  name: "管理者",
  role: "admin" as const,
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
} as unknown as CloudflareBindings;

const authedRequest = (path: string, init?: RequestInit) => {
  const req = new Request(`http://localhost${path}`, init);
  req.headers.set("Authorization", "Bearer valid-session");
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
    vi.mocked(sessionService.getUserFromSession).mockResolvedValue(testUser);
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
    ])("$method $path - 認証なしは 401", async ({ method, path }) => {
      const res = await knowledgeAdminRoutes.request(
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

      const res = await knowledgeAdminRoutes.request(
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

      const res = await knowledgeAdminRoutes.request(
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

      const res = await knowledgeAdminRoutes.request(
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

      const res = await knowledgeAdminRoutes.request(
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

      const res = await knowledgeAdminRoutes.request(
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

      const res = await knowledgeAdminRoutes.request(
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

      const res = await knowledgeAdminRoutes.request(
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

      const res = await knowledgeAdminRoutes.request(
        authedRequest("/originals/notfound.pdf"),
        undefined,
        mockEnv,
      );

      expect(res.status).toBe(404);
    });
  });
});
