import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { FileEditor } from "./FileEditor";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("FileEditor", () => {
  it("初期ロードでファイル内容を textarea に同期", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ content: "# title" }),
      ),
    );

    renderWithQuery(<FileEditor fileKey="doc.md" onClose={vi.fn()} />);

    await waitFor(() => {
      const ta = screen.getByPlaceholderText(
        "Markdown を入力...",
      ) as HTMLTextAreaElement;
      expect(ta.value).toBe("# title");
    });
  });

  it("プレビュー / 編集 切替でテキストエリアと表示が入れ替わる", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ content: "# hi" }),
      ),
    );

    renderWithQuery(<FileEditor fileKey="doc.md" onClose={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Markdown を入力...")).toBeDefined(),
    );

    fireEvent.click(screen.getByText("編集"));

    expect(screen.queryByPlaceholderText("Markdown を入力...")).toBeNull();
    expect(screen.getByText("# hi")).toBeDefined();
  });

  it("保存成功で onClose が呼ばれる", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ content: "# old" }),
      ),
      http.put(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ message: "saved" }),
      ),
    );

    const onClose = vi.fn();
    renderWithQuery(<FileEditor fileKey="doc.md" onClose={onClose} />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Markdown を入力...")).toBeDefined(),
    );

    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("ファイル取得エラーでエラーメッセージを描画", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/missing.md`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    renderWithQuery(<FileEditor fileKey="missing.md" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/エラー:/)).toBeDefined();
    });
  });
});
