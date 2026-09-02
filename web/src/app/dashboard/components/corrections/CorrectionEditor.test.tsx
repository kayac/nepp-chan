import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import type { KnowledgeCorrection } from "~/types";
import { CorrectionEditor } from "./CorrectionEditor";

const API = "http://localhost:8787";

const correction = {
  id: "cor-1",
  correctsSourcePath: "bus/index.md",
  body: "土曜は運休です",
  status: "published",
  verifiedAt: "2026-09-01",
  approvedBy: "user-1",
  relatedFeedbackId: null,
  answerRunId: null,
  needsReviewAt: null,
  needsReviewReason: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: null,
} as KnowledgeCorrection;

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("CorrectionEditor", () => {
  it("本文が未変更なら保存できない", () => {
    renderWithQuery(
      <CorrectionEditor correction={correction} onClose={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: "保存して再反映する" }),
    ).toBeDisabled();
  });

  it("本文を空にすると保存できない", async () => {
    renderWithQuery(
      <CorrectionEditor correction={correction} onClose={vi.fn()} />,
    );

    await userEvent.clear(screen.getByRole("textbox", { name: "訂正の本文" }));

    expect(
      screen.getByRole("button", { name: "保存して再反映する" }),
    ).toBeDisabled();
  });

  it("保存に成功したら閉じる", async () => {
    const onClose = vi.fn();
    server.use(
      http.patch(`${API}/admin/corrections/cor-1`, () =>
        HttpResponse.json({ message: "ok", correction }),
      ),
    );

    renderWithQuery(
      <CorrectionEditor correction={correction} onClose={onClose} />,
    );

    const textarea = screen.getByRole("textbox", { name: "訂正の本文" });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "日曜も運休です");
    await userEvent.click(
      screen.getByRole("button", { name: "保存して再反映する" }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("保存に失敗したらエラーを表示して閉じない", async () => {
    const onClose = vi.fn();
    server.use(
      http.patch(`${API}/admin/corrections/cor-1`, () =>
        HttpResponse.json(
          { error: { code: 500, message: "反映に失敗しました" } },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(
      <CorrectionEditor correction={correction} onClose={onClose} />,
    );

    const textarea = screen.getByRole("textbox", { name: "訂正の本文" });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "日曜も運休です");
    await userEvent.click(
      screen.getByRole("button", { name: "保存して再反映する" }),
    );

    expect(await screen.findByText(/反映に失敗しました/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("やめるで閉じる", async () => {
    const onClose = vi.fn();
    renderWithQuery(
      <CorrectionEditor correction={correction} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "やめる" }));

    expect(onClose).toHaveBeenCalled();
  });
});
