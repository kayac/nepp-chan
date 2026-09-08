import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createKnowledgeRepository, toFormData } from "./knowledge-repository";

const repo = createKnowledgeRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("toFormData", () => {
  it("配列は同名フィールドで複数 append し、null / undefined は送らない", () => {
    const file = new File(["a"], "a.png", { type: "image/png" });
    const fd = toFormData({
      urls: ["https://a.example/", "https://b.example/"],
      files: [file],
      text: undefined,
      nothing: null,
    });

    expect(fd.getAll("urls")).toEqual([
      "https://a.example/",
      "https://b.example/",
    ]);
    expect(fd.getAll("files")).toHaveLength(1);
    expect(fd.has("text")).toBe(false);
    expect(fd.has("nothing")).toBe(false);
  });
});

describe("knowledge-repository", () => {
  it("fetchFiles: prefix・limit・cursor をクエリに載せる", async () => {
    let query = "";
    server.use(
      http.get(`${API}/admin/knowledge/files`, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({
          files: [],
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    const result = await repo.fetchFiles({
      prefix: "official/",
      limit: 30,
      cursor: "abc",
    });

    expect(new URLSearchParams(query).get("prefix")).toBe("official/");
    expect(new URLSearchParams(query).get("limit")).toBe("30");
    expect(new URLSearchParams(query).get("cursor")).toBe("abc");
    expect(result).toEqual({ files: [], nextCursor: null, hasMore: false });
  });

  it("fetchFileContent: key を path に埋め込む", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ content: "# title" }),
      ),
    );

    const result = await repo.fetchFileContent("doc.md");
    expect(result?.content).toBe("# title");
  });

  it("saveFile: PUT で content を送る", async () => {
    server.use(
      http.put(`${API}/admin/knowledge/files/doc.md`, async ({ request }) => {
        const body = (await request.json()) as { content: string };
        expect(body.content).toBe("# new");
        return HttpResponse.json({ message: "saved" });
      }),
    );

    await repo.saveFile("doc.md", "# new");
  });

  it("deleteFile: DELETE", async () => {
    server.use(
      http.delete(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    await repo.deleteFile("doc.md");
  });

  it("uploadFile: multipart で送って key を返す", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/upload`, () =>
        HttpResponse.json({ key: "official/dir/foo.md" }),
      ),
    );

    const result = await repo.uploadFile(
      new File(["x"], "foo.md"),
      "dir/foo.md",
    );
    expect(result?.key).toBe("official/dir/foo.md");
  });

  it("convertFile: multipart で送る", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/convert`, () =>
        HttpResponse.json({ key: "k", markdown: "# x" }),
      ),
    );

    await repo.convertFile(new File(["x"], "in.pdf"), "in.pdf");
  });

  it("syncAll: POST /admin/knowledge/sync の結果を返す", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/sync`, () =>
        HttpResponse.json({ message: "queued", queued: 12 }),
      ),
    );

    const result = await repo.syncAll();
    expect(result?.queued).toBe(12);
  });

  it("draftCurated: POST /admin/knowledge/curated-draft に multipart で送る", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/curated-draft`, () =>
        HttpResponse.json({
          key: "curated/x.md",
          content: "# x",
          readUrls: [],
          unreadable: [],
        }),
      ),
    );

    const result = await repo.draftCurated({
      urls: ["https://a.example/"],
      files: [new File(["a"], "a.png", { type: "image/png" })],
    });

    expect(result?.key).toBe("curated/x.md");
  });

  it("reconvertFile: originalKey を JSON 送信", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/reconvert`, async ({ request }) => {
        const body = (await request.json()) as { originalKey: string };
        expect(body.originalKey).toBe("originals/x.pdf");
        return HttpResponse.json({ key: "k" });
      }),
    );

    await repo.reconvertFile("originals/x.pdf", "x.md");
  });

  it("失敗系: fetchFileContent 404 は throw", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/missing.md`, () =>
        HttpResponse.json({ error: { message: "not found" } }, { status: 404 }),
      ),
    );

    await expect(repo.fetchFileContent("missing.md")).rejects.toBeDefined();
  });

  it("失敗系: saveFile 500 は throw", async () => {
    server.use(
      http.put(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    await expect(repo.saveFile("doc.md", "x")).rejects.toBeDefined();
  });

  describe("残りの失敗系", () => {
    it("fetchFiles: 5xx は throw", async () => {
      server.use(
        http.get(`${API}/admin/knowledge/files`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(
        repo.fetchFiles({ prefix: "official/" }),
      ).rejects.toBeDefined();
    });

    it("deleteFile: 5xx は throw", async () => {
      server.use(
        http.delete(`${API}/admin/knowledge/files/x`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(repo.deleteFile("x")).rejects.toBeDefined();
    });

    it("uploadFile: 5xx は throw", async () => {
      server.use(
        http.post(`${API}/admin/knowledge/upload`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(
        repo.uploadFile(new File(["x"], "f.md"), "f.md"),
      ).rejects.toBeDefined();
    });

    it("convertFile: 5xx は throw", async () => {
      server.use(
        http.post(`${API}/admin/knowledge/convert`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(
        repo.convertFile(new File(["x"], "f.pdf"), "f.pdf"),
      ).rejects.toBeDefined();
    });

    it("reconvertFile: 5xx は throw", async () => {
      server.use(
        http.post(`${API}/admin/knowledge/reconvert`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(
        repo.reconvertFile("originals/x.pdf", "x.md"),
      ).rejects.toBeDefined();
    });
  });
});
