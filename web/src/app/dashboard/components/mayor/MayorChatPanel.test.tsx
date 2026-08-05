import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { buildChatStreamResponse } from "~/test/chat-stream";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { MayorChatPanel } from "./MayorChatPanel";

const API = "http://localhost:8787";

const useChatHandlers = () => {
  const chatBodies: unknown[] = [];
  server.use(
    http.post(`${API}/threads`, () =>
      HttpResponse.json(
        {
          id: "t-1",
          resourceId: "admin:u-1",
          title: "村長モード",
          createdAt: "2026-07-29T00:00:00Z",
          updatedAt: "2026-07-29T00:00:00Z",
          metadata: null,
        },
        { status: 201 },
      ),
    ),
    http.post(`${API}/threads/t-1/chat`, async ({ request }) => {
      chatBodies.push(await request.json());
      return buildChatStreamResponse(
        "12件を読んでみたよ。ざっくり言うと捨て方の不満が広がってる感じ",
      );
    }),
  );
  return chatBodies;
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("MayorChatPanel", () => {
  it("文脈付きで開くとスレッドを作成し、分析依頼を自動送信して応答を表示する", async () => {
    const chatBodies = useChatHandlers();
    renderWithQuery(
      <MayorChatPanel
        isOpen
        request={{ context: "今週 × ネガティブ・12件" }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/12件を読んでみたよ/)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/📊 今週 × ネガティブ・12件 について/),
    ).toBeInTheDocument();
    expect(chatBodies).toHaveLength(1);
    expect(JSON.stringify(chatBodies[0])).toContain("今週 × ネガティブ・12件");
  });

  it("フォローアップチップでメッセージを送信できる", async () => {
    const chatBodies = useChatHandlers();
    renderWithQuery(
      <MayorChatPanel
        isOpen
        request={{ context: "直近30日・34件" }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/12件を読んでみたよ/)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "元の声を見せて" }));

    await waitFor(() => {
      expect(chatBodies).toHaveLength(2);
    });
    expect(JSON.stringify(chatBodies[1])).toContain("元の声を見せて");
  });

  it("入力欄からメッセージを送信できる", async () => {
    const chatBodies = useChatHandlers();
    renderWithQuery(<MayorChatPanel isOpen request={null} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("このデータについて聞く…"),
      ).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText("このデータについて聞く…"),
      "村の調子はどう？",
    );
    await user.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(chatBodies).toHaveLength(1);
    });
    expect(JSON.stringify(chatBodies[0])).toContain("村の調子はどう？");
  });

  it("閉じるボタンで onClose が呼ばれる", async () => {
    useChatHandlers();
    const onClose = vi.fn();
    renderWithQuery(<MayorChatPanel isOpen request={null} onClose={onClose} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalled();
  });
});
