import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "../lib/auth-token";
import { server } from "../test/msw-server";
import {
  convertFile,
  deleteAllKnowledge,
  deleteFile,
  fetchFileContent,
  fetchFiles,
  fetchUnifiedFiles,
  getOriginalFileUrl,
  reconvertFile,
  saveFile,
  syncKnowledge,
  uploadFile,
} from "./knowledge-repository";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("knowledge-repository", () => {
  it("syncKnowledge: POST /admin/knowledge/sync", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/sync`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    await syncKnowledge();
  });

  it("deleteAllKnowledge: DELETE /admin/knowledge", async () => {
    server.use(
      http.delete(`${API}/admin/knowledge`, () =>
        HttpResponse.json({ message: "ok", count: 100 }),
      ),
    );

    const result = await deleteAllKnowledge();
    expect(result?.count).toBe(100);
  });

  it("fetchFiles: ファイル一覧を返す", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files`, () =>
        HttpResponse.json({ files: [] }),
      ),
    );

    await fetchFiles();
  });

  it("fetchFileContent: key を path に埋め込む", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ content: "# title" }),
      ),
    );

    const result = await fetchFileContent("doc.md");
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

    await saveFile("doc.md", "# new");
  });

  it("deleteFile: DELETE", async () => {
    server.use(
      http.delete(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    await deleteFile("doc.md");
  });

  it("uploadFile: multipart に file + filename を入れる", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/upload`, () =>
        HttpResponse.json({ key: "k" }),
      ),
    );

    await uploadFile(new File(["x"], "foo.md"), "foo.md");
  });

  it("convertFile: multipart で送る", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/convert`, () =>
        HttpResponse.json({ key: "k", markdown: "# x" }),
      ),
    );

    await convertFile(new File(["x"], "in.pdf"), "in.pdf");
  });

  it("fetchUnifiedFiles", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/unified`, () =>
        HttpResponse.json({ files: [] }),
      ),
    );

    await fetchUnifiedFiles();
  });

  it("reconvertFile: originalKey を JSON 送信", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/reconvert`, async ({ request }) => {
        const body = (await request.json()) as { originalKey: string };
        expect(body.originalKey).toBe("originals/x.pdf");
        return HttpResponse.json({ key: "k" });
      }),
    );

    await reconvertFile("originals/x.pdf", "x.md");
  });

  it("getOriginalFileUrl: originals/ プレフィックスを除いて URL 生成", () => {
    const url = getOriginalFileUrl("originals/foo bar.pdf");
    expect(url).toMatch(/foo%20bar\.pdf$/);
    expect(url).not.toContain("originals/originals");
  });
});
