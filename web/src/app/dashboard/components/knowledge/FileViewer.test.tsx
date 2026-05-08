import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "../../../../lib/auth-token";
import { server } from "../../../../test/msw-server";
import { renderWithQuery } from "../../../../test/query";
import { FileViewer } from "./FileViewer";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("FileViewer", () => {
  it("ロード中は『読み込み中...』を表示", () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/doc.md`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ content: "" });
      }),
    );

    renderWithQuery(<FileViewer fileKey="doc.md" onClose={vi.fn()} />);
    expect(screen.getByText("読み込み中...")).toBeDefined();
  });

  it("ファイル内容を表示し、閉じるボタンで onClose 呼び出し", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ content: "# title\nbody" }),
      ),
    );

    const onClose = vi.fn();
    renderWithQuery(<FileViewer fileKey="doc.md" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/# title/)).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("API エラーで『エラー: ...』を表示し、閉じるボタンで onClose", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/missing.md`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    const onClose = vi.fn();
    renderWithQuery(<FileViewer fileKey="missing.md" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/エラー:/)).toBeDefined();
    });

    fireEvent.click(screen.getByText("閉じる"));
    expect(onClose).toHaveBeenCalled();
  });
});
