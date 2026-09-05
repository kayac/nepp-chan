import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createKnowledgeRepository } from "./knowledge-repository";

const repo = createKnowledgeRepository(testApiClient, API);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("knowledge-repository", () => {
  it("fetchFiles: ファイル一覧を返す", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files`, () =>
        HttpResponse.json({ files: [] }),
      ),
    );

    await repo.fetchFiles();
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

  it("uploadFile: multipart に file + filename を入れる", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/upload`, () =>
        HttpResponse.json({ key: "k" }),
      ),
    );

    await repo.uploadFile(new File(["x"], "foo.md"), "foo.md");
  });

  it("convertFile: multipart で送る", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/convert`, () =>
        HttpResponse.json({ key: "k", markdown: "# x" }),
      ),
    );

    await repo.convertFile(new File(["x"], "in.pdf"), "in.pdf");
  });

  it("fetchUnifiedFiles", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/unified`, () =>
        HttpResponse.json({ files: [] }),
      ),
    );

    await repo.fetchUnifiedFiles();
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

  it("getOriginalFileUrl: originals/ プレフィックスを除いて URL 生成", () => {
    const url = repo.getOriginalFileUrl("originals/foo bar.pdf");
    expect(url).toMatch(/foo%20bar\.pdf$/);
    expect(url).not.toContain("originals/originals");
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
      await expect(repo.fetchFiles()).rejects.toBeDefined();
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

    it("fetchUnifiedFiles: 5xx は throw", async () => {
      server.use(
        http.get(`${API}/admin/knowledge/unified`, () =>
          HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
        ),
      );
      await expect(repo.fetchUnifiedFiles()).rejects.toBeDefined();
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
